import { NextResponse } from "next/server";
import { deliverEmailCode } from "@/lib/email";
import { getUserById, issueEmailChangeCode, StoreError, verifyEmailChangeCode } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";

async function userIdFrom(request: Request) {
  return (await requireUser(request)).id;
}

export async function POST(request: Request) {
  try {
    const userId = await userIdFrom(request);
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase() || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError("Укажите корректный email.", 400);
    if ((await getUserById(userId))?.email === email) throw new StoreError("Это уже ваш текущий email.", 400);
    const code = await issueEmailChangeCode(userId, email);
    const delivery = await deliverEmailCode(email, code, "change", { exposeOnScreen: true });
    return NextResponse.json({
      success: true,
      ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
      message: delivery.delivered ? "Код подтверждения отправлен на новый email." : "SMTP не настроен. Тестовый код показан ниже и выведен в консоль сервера.",
    }, { status: 202 });
  } catch (error) {
    const configurationError = error instanceof Error &&
      (error.message.startsWith("Настройте SMTP") || error.message.startsWith("Не удалось отправить email") || error.message.includes("AUTH_CODE_SECRET"));
    if (error && !(error instanceof StoreError) && !configurationError) console.error("Email-change code delivery failed:", error);
    const status = error instanceof StoreError ? error.status : configurationError ? 503 : 500;
    const message = configurationError
      ? error instanceof Error && error.message.includes("AUTH_CODE_SECRET")
        ? "Настройте AUTH_CODE_SECRET в backend .env."
        : error.message
      : error instanceof StoreError ? error.message : "Не удалось изменить email. Проверьте настройки сервера.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await userIdFrom(request);
    const body = await request.json() as { email?: string; code?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const code = body.code?.trim() || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      throw new StoreError("Укажите новый email и шестизначный код.", 400);
    }
    await verifyEmailChangeCode(userId, email, code);
    return NextResponse.json({ success: true, message: "Email успешно изменён." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось подтвердить email." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
