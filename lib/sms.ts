import { getIntegrationValue } from "@/lib/integrations";

const friendlyError = "Не удалось отправить SMS. Проверьте настройки SMS.";

/**
 * Names of the environment variables the SMS provider needs. Only names are
 * ever surfaced (in the server log or in the admin panel) — values and tokens
 * are never returned.
 */
export function getSmsMissingConfiguration() {
  const provider = getIntegrationValue("SMS_PROVIDER").toLowerCase();
  const accountSid = getIntegrationValue("SMS_API_KEY");
  const authToken = getIntegrationValue("SMS_API_SECRET");
  const sender = getIntegrationValue("SMS_SENDER");
  const missing = [
    !provider && "SMS_PROVIDER=twilio",
    !accountSid && "SMS_API_KEY",
    !authToken && "SMS_API_SECRET",
    !sender && "SMS_SENDER",
  ].filter(Boolean) as string[];
  if (provider && provider !== "twilio") missing.push(`SMS_PROVIDER=${provider} (поддерживается twilio)`);
  if (accountSid && !/^AC[0-9a-f]{32}$/i.test(accountSid)) missing.push("SMS_API_KEY (ожидается Account SID Twilio)");
  return missing;
}

export function getSmsConfigurationError() {
  const missing = getSmsMissingConfiguration();
  if (missing.length) return `Настройте ${missing.join(", ")} в backend .env.`;
  return null;
}

/**
 * Local mode: development (`NODE_ENV !== 'production'`) or missing provider keys.
 * In this mode a delivery problem must never fail the request — the code is
 * printed to the server console instead.
 */
export function canUseSmsCodeFallback() {
  return process.env.NODE_ENV !== "production" || getSmsMissingConfiguration().length > 0;
}

export type SmsDelivery = { delivered: boolean };

/**
 * Sends the code through Twilio when credentials exist. In local mode the code
 * is always printed to the server console as `[DEV SMS CODE]: <code>` and a
 * real provider failure is downgraded to a warning, so password recovery keeps
 * working without a configured SMS provider.
 */
export async function sendSmsCode(phone: string, code: string): Promise<SmsDelivery> {
  const missing = getSmsMissingConfiguration();
  if (canUseSmsCodeFallback()) {
    if (missing.length) {
      console.warn("SMS provider is not configured (local mode). Missing environment variables:", missing.join(", "));
    }
    console.log(`[DEV SMS CODE]: ${code}`);
    if (missing.length) return { delivered: false };
    // Keys are present in development: try a real send, but never block the flow.
    try {
      await requestTwilioSms(phone, code);
      return { delivered: true };
    } catch (error) {
      console.warn("Dev SMS delivery skipped:", error instanceof Error ? error.message : error);
      return { delivered: false };
    }
  }
  await requestTwilioSms(phone, code);
  return { delivered: true };
}

async function requestTwilioSms(phone: string, code: string) {
  const accountSid = getIntegrationValue("SMS_API_KEY") as string;
  const authToken = getIntegrationValue("SMS_API_SECRET") as string;
  const sender = getIntegrationValue("SMS_SENDER") as string;

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: sender,
        Body: `Код HASI.TJ: ${code}. Срок действия — 10 минут.`,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error("SMS provider rejected a verification message. HTTP status:", response.status);
      throw new Error(friendlyError);
    }
  } catch (error) {
    if (error instanceof Error && error.message === friendlyError) throw error;
    // Network, TLS and timeout failures land here: log the technical reason,
    // answer the visitor with a readable message and never expose credentials.
    console.error("SMS provider request failed:", error instanceof Error ? error.message : error);
    throw new Error(friendlyError);
  }
}
