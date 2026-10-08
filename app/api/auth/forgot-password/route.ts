import { NextResponse } from "next/server";
import { canUseCodeFallback, deliverEmailCode, getEmailConfigurationError } from "@/lib/email";
import { getUserByEmail, issuePasswordResetCode, StoreError } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase() || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError("Укажите корректный email.", 400);
    const configurationError = getEmailConfigurationError();
    if (configurationError && !canUseCodeFallback()) return NextResponse.json({ error: configurationError }, { status: 503 });
    const user = await getUserByEmail(email);
    // Without SMTP (dev or production fallback) deliverEmailCode prints
    // `[DEV EMAIL CODE]: <code>` to the server console and returns the code,
    // so the form can show it under the input — same as registration.
    const code = user ? await issuePasswordResetCode(email) : null;
    const delivery = code ? await deliverEmailCode(email, code, "reset", { exposeOnScreen: true }) : null;
    return NextResponse.json({
      success: true,
      ...(delivery?.devCode ? { devCode: delivery.devCode } : {}),
      message: "Если аккаунт с таким email существует, код отправлен. Проверьте почту.",
    });
  } catch (error) {
    const configurationError = error instanceof Error &&
      (error.message.startsWith("Настройте SMTP") || error.message.startsWith("Не удалось отправить email") || error.message.includes("AUTH_CODE_SECRET"));
    if (error && !(error instanceof StoreError) && !configurationError) console.error("Password-reset code delivery failed:", error);
    const status = error instanceof StoreError ? error.status : configurationError ? 503 : 500;
    const message = configurationError
      ? error instanceof Error && error.message.includes("AUTH_CODE_SECRET")
        ? "Настройте AUTH_CODE_SECRET в backend .env."
        : error.message
      : error instanceof StoreError ? error.message : "Не удалось отправить код. Проверьте настройки сервера.";
    return NextResponse.json({ error: message }, { status });
  }
}
