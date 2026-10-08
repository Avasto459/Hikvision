import { NextResponse } from "next/server";
import { deliverEmailCode } from "@/lib/email";
import { resendRegistrationCode, StoreError } from "@/lib/db";

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json() as { email?: string };
    email = body.email?.trim().toLowerCase() || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError("Укажите корректный email.", 400);
    const code = await resendRegistrationCode(email);
    const delivery = await deliverEmailCode(email, code, "verify", { exposeOnScreen: true });
    return NextResponse.json({
      success: true,
      ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
      message: delivery.delivered ? "Новый код отправлен на email." : "SMTP не настроен. Новый тестовый код показан ниже и выведен в консоль сервера.",
    });
  } catch (error) {
    const configurationError = error instanceof Error &&
      (error.message.startsWith("Настройте SMTP") || error.message.startsWith("Не удалось отправить email") || error.message.includes("AUTH_CODE_SECRET"));
    if (error && !(error instanceof StoreError)) console.error("Verification-code delivery failed:", error instanceof Error ? error.message : error);
    const status = error instanceof StoreError ? error.status : configurationError ? 503 : 500;
    const message = configurationError
      ? error instanceof Error && error.message.includes("AUTH_CODE_SECRET") ? "Настройте AUTH_CODE_SECRET в backend .env." : error.message
      : error instanceof StoreError ? error.message : "Не удалось отправить код. Проверьте настройки сервера.";
    return NextResponse.json({ error: message }, { status });
  }
}
