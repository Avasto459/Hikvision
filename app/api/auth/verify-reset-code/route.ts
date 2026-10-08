import { NextResponse } from "next/server";
import { StoreError, verifyPasswordResetCode } from "@/lib/db";

type VerifyBody = { email?: string; emailOrPhone?: string; code?: string };

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, message }, { status });
}

/**
 * Step 2 gate of the password-recovery form: checks the 6-digit code against
 * the stored hash *without* consuming it, so the new-password fields are only
 * unlocked when the code (including the on-screen test code) matches. Wrong
 * guesses consume the 5 allowed attempts and end with 429.
 */
export async function POST(request: Request) {
  let body: VerifyBody;
  try {
    body = await request.json() as VerifyBody;
  } catch {
    return jsonError("Некорректный запрос: передайте JSON с кодом подтверждения.", 400);
  }

  try {
    const identifier = (body.emailOrPhone || body.email || "").trim();
    const code = body.code?.trim() || "";
    if (!identifier) throw new StoreError("Укажите email или телефон, к которому отправлен код.", 400);
    if (!/^\d{6}$/.test(code)) throw new StoreError("Укажите шестизначный код из сообщения.", 400);
    await verifyPasswordResetCode(identifier, code);
    return NextResponse.json({ success: true, message: "Код подтверждён. Придумайте новый пароль." });
  } catch (error) {
    if (error instanceof StoreError) return jsonError(error.message, error.status);
    console.error("Reset-code verification failed:", error instanceof Error ? (error.stack || error.message) : error);
    return jsonError("Не удалось проверить код. Попробуйте позже.", 500);
  }
}
