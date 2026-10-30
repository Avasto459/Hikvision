import { NextResponse } from "next/server";
import { sendSmsCode } from "@/lib/sms";
import { issuePhonePasswordResetCode, StoreError } from "@/lib/db";
import { normalizeTajikPhone } from "@/lib/phone";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string };
    const phone = normalizeTajikPhone(body.phone || "");
    if (!phone) throw new StoreError("Укажите номер телефона в формате +992XXXXXXXXX.", 400);

    // Local mode (development or missing SMS keys) never fails the request:
    // sendSmsCode prints `[DEV SMS CODE]: <code>` to the server console instead.
    const code = await issuePhonePasswordResetCode(phone);
    const delivery = code ? await sendSmsCode(phone, code) : null;
    // When the SMS provider is not configured (or delivery failed) the code
    // went to the server console only — return it so the form can show it
    // under the input, same as the e-mail flow without SMTP. A code that was
    // actually sent over SMS is never included.
    const devCode = code && !delivery?.delivered ? code : undefined;
    return NextResponse.json({
      success: true,
      ...(devCode ? { devCode } : {}),
      message: "Если аккаунт с таким телефоном существует, код отправлен. Проверьте SMS.",
    });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("SMS password-reset delivery failed:", error instanceof Error ? error.message : error);
    const status = error instanceof StoreError ? error.status : 502;
    const message = error instanceof StoreError ? error.message : "Не удалось отправить SMS. Проверьте настройки SMS.";
    return NextResponse.json({ error: message }, { status });
  }
}
