import nodemailer from "nodemailer";
import { getIntegrationValue } from "@/lib/integrations";

type SmtpKey = "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASSWORD" | "SMTP_FROM" | "SMTP_SECURE";
const env = (key: SmtpKey) => getIntegrationValue(key);

/** SMTP_PASSWORD is the canonical project variable; SMTP_PASS is accepted as a common .env alias. */
function smtpPassword() {
  return env("SMTP_PASSWORD") || (process.env.SMTP_PASS || "").trim();
}

/** Names of the SMTP variables that are not filled in. Values are never returned. */
export function getMissingEmailConfiguration() {
  return [
    !env("SMTP_HOST") && "SMTP_HOST",
    !env("SMTP_PORT") && "SMTP_PORT",
    !env("SMTP_USER") && "SMTP_USER",
    !smtpPassword() && "SMTP_PASSWORD (или SMTP_PASS)",
    !env("SMTP_FROM") && "SMTP_FROM",
  ].filter(Boolean) as string[];
}

export function getEmailConfigurationError() {
  const missing = getMissingEmailConfiguration();
  if (missing.length) {
    return `Настройте SMTP в backend .env (.env.local): отсутствуют переменные — ${missing.join(", ")}. После заполнения перезапустите npm run dev.`;
  }
  // The code-hashing secret is not a blocker: lib/db.ts falls back to
  // AUTH_CODE_SECRET → JWT_SECRET → a built-in dev secret (see getCodeSecret).
  return null;
}

function getTransport() {
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT") || 0);
  const user = env("SMTP_USER");
  const pass = smtpPassword();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass) {
    throw new Error("Настройте SMTP_HOST, SMTP_PORT, SMTP_USER и SMTP_PASSWORD (или SMTP_PASS) для отправки писем.");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: env("SMTP_SECURE") ? env("SMTP_SECURE") === "true" : port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

export async function sendEmailCode(email: string, code: string, purpose: "verify" | "reset" | "change") {
  const labels = {
    verify: "Подтверждение email",
    reset: "Восстановление пароля",
    change: "Смена email",
  };
  const subject = `${labels[purpose]} — HASI.TJ`;
  const from = env("SMTP_FROM");
  const configurationError = getEmailConfigurationError();
  if (configurationError) {
    // Report every missing variable in the server log, names only, no values.
    console.error("Verification email was not sent. Missing environment variables:", getMissingEmailConfiguration().join(", ") || "нет");
    throw new Error(configurationError);
  }
  await sendMail(getTransport(), {
    from: `"HASI.TJ" <${from}>`,
    to: email,
    subject,
    text: `${labels[purpose]}\n\nВаш код: ${code}\nКод действует 10 минут. Если вы не запрашивали его, проигнорируйте это письмо.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111827"><h1 style="font-size:22px">${labels[purpose]}</h1><p>Код подтверждения:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#6d28d9">${code}</p><p>Код действует 10 минут. Если вы не запрашивали его, проигнорируйте это письмо.</p><p>HASI.TJ</p></div>`,
  });
}

type MailOptions = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

/** Sends a message and turns provider failures into a readable reason. */
async function sendMail(transport: ReturnType<typeof getTransport>, options: MailOptions) {
  try {
    await transport.sendMail(options);
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    // `code` never contains the password or any other credential.
    const code = String((reason as { code?: string }).code || "");
    if (code === "EAUTH" || /535|534|invalid credentials|authentication/i.test(reason.message)) {
      console.error("SMTP authentication failed. Provider code:", code || "n/a");
      throw new Error("Не удалось отправить email: SMTP authentication failed — проверьте SMTP_USER и SMTP_PASSWORD (или SMTP_PASS).");
    }
    if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH", "ECONNRESET"].includes(code)) {
      console.error("SMTP connection failed. Provider code:", code);
      throw new Error("Не удалось отправить email: SMTP connection failed — проверьте SMTP_HOST и SMTP_PORT.");
    }
    console.error("Email sending failed. Provider code:", code || "n/a", "|", reason.message);
    throw new Error("Не удалось отправить email: SMTP sender rejected или email sending failed.");
  }
}

/**
 * Sends a free-form HTML/text email through the same SMTP provider that is used
 * for verification codes. Used by the admin panel to answer contact messages.
 */
export async function sendEmailMessage(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}) {
  const from = env("SMTP_FROM");
  const configurationError = getEmailConfigurationError();
  if (configurationError) {
    console.error("Email was not sent. Missing environment variables:", getMissingEmailConfiguration().join(", ") || "нет");
    throw new Error(configurationError);
  }
  await sendMail(getTransport(), {
    from: `"HASI.TJ" <${from}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || options.text.split(/\n{2,}/).map((line) => `<p>${escapeHtml(line).replace(/\n/g, "<br>")}</p>`).join(""),
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** True when no SMTP server is configured (variables missing), so real delivery is impossible. */
export function isEmailDeliveryUnavailable() {
  return getMissingEmailConfiguration().length > 0;
}

/**
 * Fallback for installations without SMTP. Instead of blocking the visitor, the
 * code is printed to the server console. `exposeOnScreen` additionally returns
 * it to the caller so the registration form can show it. Set
 * HASI_REQUIRE_EMAIL_DELIVERY=true to disable the fallback in production.
 */
export function canUseCodeFallback() {
  return isEmailDeliveryUnavailable() && process.env.HASI_REQUIRE_EMAIL_DELIVERY !== "true";
}

export type CodeDelivery = { delivered: boolean; devCode?: string };

export async function deliverEmailCode(
  email: string,
  code: string,
  purpose: "verify" | "reset" | "change",
  options: { exposeOnScreen?: boolean } = {},
): Promise<CodeDelivery> {
  const dev = process.env.NODE_ENV !== "production";
  if (canUseCodeFallback()) {
    if (dev) {
      console.log(`[DEV EMAIL CODE]: ${code}`);
      console.warn(`[HASI] SMTP не настроен — код (${purpose}) для ${email} выведен в консоль (см. [DEV EMAIL CODE]).`);
    } else {
      console.warn(`[HASI] SMTP не настроен — тестовый код (${purpose}) для ${email}: ${code}`);
    }
    return { delivered: false, ...(options.exposeOnScreen ? { devCode: code } : {}) };
  }
  if (dev) {
    // A broken SMTP setup must not block development: log the reason, print the
    // code to the console and let the caller continue with the on-screen hint.
    try {
      await sendEmailCode(email, code, purpose);
      return { delivered: true };
    } catch (error) {
      console.warn(`[HASI] Не удалось отправить письмо (${purpose}) для ${email}:`, error instanceof Error ? error.message : error);
      console.log(`[DEV EMAIL CODE]: ${code}`);
      return { delivered: false, ...(options.exposeOnScreen ? { devCode: code } : {}) };
    }
  }
  // SMTP настроен, но недоступен (неверный пароль, блокировка порта и т.п.).
  // Тестовый режим: не блокируем восстановление доступа — выдаём код на экране.
  // Отключается переменной HASI_REQUIRE_EMAIL_DELIVERY=true (обязательно для боевого сервера).
  try {
    await sendEmailCode(email, code, purpose);
    return { delivered: true };
  } catch (error) {
    if (process.env.HASI_REQUIRE_EMAIL_DELIVERY === "true") throw error;
    console.warn(`[HASI] Не удалось отправить письмо (${purpose}) для ${email}:`, error instanceof Error ? error.message : error);
    console.warn(`[HASI] Тестовый код (${purpose}) для ${email}: ${code}`);
    return { delivered: false, ...(options.exposeOnScreen ? { devCode: code } : {}) };
  }
}

/** Авто-ответ клиенту после отправки формы «Контакты». Бросает ошибку — вызывающий код её перехватывает. */
export async function sendContactAutoReply(to: string, name: string) {
  await sendEmailMessage({
    to,
    subject: "Мы получили ваше сообщение — HASI.TJ",
    text: `Здравствуйте, ${name}!\n\nСпасибо за обращение! Мы свяжемся с вами в ближайшее время.\n\nHASI.TJ`,
  });
}
