import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { completePasswordReset, completePhonePasswordReset, StoreError } from "@/lib/db";
import { normalizeTajikPhone } from "@/lib/phone";

type ResetBody = { email?: string; emailOrPhone?: string; code?: string; password?: string; confirmPassword?: string };

/**
 * Every exit of this handler answers with JSON: `{ success, message, error }`.
 * A visitor (and the form) must never receive an HTML error page instead.
 */
function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, message }, { status });
}

export async function POST(request: Request) {
  // 1) The payload itself: a broken body is a client mistake (400), not a server crash.
  let body: ResetBody;
  try {
    body = await request.json() as ResetBody;
  } catch {
    return jsonError("Некорректный запрос: передайте JSON с кодом подтверждения и новым паролем.", 400);
  }

  try {
    const identifier = (body.emailOrPhone || body.email || "").trim();
    const code = body.code?.trim() || "";
    if (!/^\d{6}$/.test(code)) {
      throw new StoreError("Укажите email или телефон, к которому отправлен код, и шестизначный код.", 400);
    }
    if (!body.password || body.password.length < 8 || body.password.length > 128) {
      throw new StoreError("Новый пароль должен содержать от 8 до 128 символов.", 400);
    }
    if (body.confirmPassword !== body.password) throw new StoreError("Пароли не совпадают.", 400);

    const passwordHash = await hashPassword(body.password);
    // Database access happens here: validation problems keep their status code,
    // anything unexpected (missing/corrupt database, hashing) is logged and
    // answered with readable JSON — the handler never throws out of this block.
    if (identifier.includes("@")) await completePasswordReset(identifier.toLowerCase(), code, passwordHash);
    else if (normalizeTajikPhone(identifier)) await completePhonePasswordReset(identifier, code, passwordHash);
    else throw new StoreError("Укажите корректный email или телефон.", 400);

    return NextResponse.json({ success: true, message: "Пароль успешно изменён" });
  } catch (error) {
    if (error instanceof StoreError) return jsonError(error.message, error.status);
    // Never leak internal details (paths, SQL text) to the browser.
    console.error("Password reset failed:", error instanceof Error ? (error.stack || error.message) : error);
    return jsonError("Не удалось обновить пароль. Попробуйте позже.", 500);
  }
}
