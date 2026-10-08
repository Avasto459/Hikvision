import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { saveActivity, StoreError } from "@/lib/db";
import { getEmailConfigurationError, getMissingEmailConfiguration } from "@/lib/email";
import {
  clearIntegration, describeIntegration, getIntegrationValue, integrationFields, saveIntegrationValues,
  type IntegrationGroup,
} from "@/lib/integrations";
import { hasCustomJwtSecret } from "@/lib/jwt-secret";
import { getSmsMissingConfiguration } from "@/lib/sms";

function overview() {
  // Приложение работает и с fallback-секретом; флаг лишь подсказывает, что в production нужен свой.
  const jwtOk = hasCustomJwtSecret();
  const emailProblem = getEmailConfigurationError();
  const smsMissing = getSmsMissingConfiguration();
  const telegramMissing = [
    !getIntegrationValue("TELEGRAM_BOT_TOKEN") && "TELEGRAM_BOT_TOKEN",
      ].filter(Boolean) as string[];
  return {
    auth: { configured: jwtOk, missing: jwtOk ? [] : ["JWT_SECRET"], fields: [] },
    email: { configured: !emailProblem, missing: getMissingEmailConfiguration(), problem: emailProblem, fields: describeIntegration("email") },
    sms: { configured: smsMissing.length === 0, missing: smsMissing, fields: describeIntegration("sms") },
    telegram: { configured: telegramMissing.length === 0, missing: telegramMissing, fields: describeIntegration("telegram") },
  };
}

function fail(error: unknown, fallback: string) {
  if (error && !(error instanceof StoreError)) console.error(fallback, error);
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, {
    status: error instanceof StoreError ? error.status : 500,
  });
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ integrations: overview() });
  } catch (error) {
    return fail(error, "Не удалось проверить настройки.");
  }
}

/** Saves values for one group. Secret fields left empty keep their stored value. */
export async function PUT(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json() as { group?: string; values?: Record<string, unknown> };
    const group = body.group as IntegrationGroup;
    if (!group || !(group in integrationFields)) throw new StoreError("Неизвестная интеграция.", 400);
    const values: Record<string, string> = {};
    for (const key of integrationFields[group]) {
      const value = body.values?.[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string") throw new StoreError(`Поле ${key} должно быть строкой.`, 400);
      values[key] = value;
    }
    if (values.SMTP_PORT && !/^\d{1,5}$/.test(values.SMTP_PORT.trim())) throw new StoreError("SMTP_PORT должен быть числом.", 400);
    if (values.SMTP_FROM && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.SMTP_FROM.trim())) throw new StoreError("SMTP_FROM должен быть email-адресом.", 400);
    if (values.SMS_PROVIDER && values.SMS_PROVIDER.trim().toLowerCase() !== "twilio") throw new StoreError("Поддерживается только провайдер twilio.", 400);
    await saveIntegrationValues(group, values);
    await saveActivity(actor.id, "integration-update", `Обновлены настройки интеграции: ${group}`);
    return NextResponse.json({ success: true, integrations: overview() });
  } catch (error) {
    return fail(error, "Не удалось сохранить настройки интеграции.");
  }
}

/** Removes the values saved in the panel, so the environment variables apply again. */
export async function DELETE(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const group = new URL(request.url).searchParams.get("group") as IntegrationGroup | null;
    if (!group || !(group in integrationFields)) throw new StoreError("Неизвестная интеграция.", 400);
    await clearIntegration(group);
    await saveActivity(actor.id, "integration-reset", `Сброшены настройки интеграции: ${group}`);
    return NextResponse.json({ success: true, integrations: overview() });
  } catch (error) {
    return fail(error, "Не удалось сбросить настройки интеграции.");
  }
}
