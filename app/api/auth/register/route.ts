import { NextResponse } from "next/server";
import { hashPassword, signToken } from "@/lib/auth";
import { deliverEmailCode } from "@/lib/email";
import {
  createUser,
  findMemoryUserByEmail,
  getPublicUser,
  getUserByEmail,
  getUserByPhone,
  getUserDisplayName,
  isReadOnlyMode,
  issueRegistrationCode,
  saveMemoryUser,
  StoreError,
} from "@/lib/db";
import { normalizeTajikPhone } from "@/lib/phone";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

/** П.3: JWT { id, email, name, role } + secure cookie (httpOnly, path=/, lax, secure). */
function issueAutoLogin(request: Request, user: Parameters<typeof getPublicUser>[0]) {
  const publicUser = getPublicUser(user);
  const token = signToken({
    id: publicUser.id,
    email: publicUser.email,
    name: publicUser.name || getUserDisplayName(user),
    role: publicUser.role as "USER" | "ADMIN",
  });
  const response = NextResponse.json({
    success: true,
    autoLogin: true,
    message: "Аккаунт создан. Вы автоматически вошли в систему.",
    token,
    user: publicUser,
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(request));
  return response;
}

export async function POST(request: Request) {
  let email = "";
  let registrationPending = false;
  try {
    const body = await request.json() as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      password?: string;
      confirmPassword?: string;
    };
    email = body.email?.trim().toLowerCase() || "";
    const firstName = body.firstName?.trim() || "";
    const lastName = body.lastName?.trim() || "";
    const phone = body.phone?.trim() || "";
    if (!firstName || !lastName || !email || !phone || !body.password || !body.confirmPassword) {
      throw new StoreError("Заполните все поля.", 400);
    }
    const normalizedPhone = normalizeTajikPhone(phone);
    if (firstName.length > 100 || lastName.length > 100 || !normalizedPhone ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.password.length < 8 || body.password.length > 128) {
      throw new StoreError("Проверьте email и телефон в формате +992XXXXXXXXX; пароль должен содержать от 8 до 128 символов.", 400);
    }
    if (body.password !== body.confirmPassword) throw new StoreError("Пароли не совпадают.", 400);
    if (await getUserByEmail(email) || await findMemoryUserByEmail(email)) {
      throw new StoreError("Пользователь с таким email уже существует.", 409);
    }
    if (await getUserByPhone(normalizedPhone)) {
      throw new StoreError("Пользователь с таким телефоном уже существует.", 409);
    }

    const passwordHash = await hashPassword(body.password);

    // П.2: read-only окружение Vercel — создаём пользователя сразу в памяти
    // (createUser сам выберет память при read-only) и АВТО-АВТОРИЗУЕМ (П.1):
    // JWT + cookie, редирект на /admin или /account по роли.
    if (isReadOnlyMode()) {
      const user = await createUser({ firstName, lastName, email, phone: normalizedPhone, passwordHash });
      saveMemoryUser(user!);
      return issueAutoLogin(request, user!);
    }

    const code = await issueRegistrationCode({ email, firstName, lastName, phone: normalizedPhone, passwordHash });
    registrationPending = true;
    const delivery = await deliverEmailCode(email, code, "verify", { exposeOnScreen: true });
    return NextResponse.json({
      success: true,
      requiresVerification: true,
      ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
      message: delivery.delivered
        ? "Код подтверждения отправлен на email."
        : "SMTP не настроен, поэтому письмо не отправлено. Тестовый код показан ниже и выведен в консоль сервера.",
    }, { status: 202 });
  } catch (error) {
    const configurationError = error instanceof Error &&
      (error.message.startsWith("Настройте SMTP") || error.message.startsWith("Не удалось отправить email") || error.message.includes("AUTH_CODE_SECRET"));
    if (error && !(error instanceof StoreError)) console.error("Registration failed:", error instanceof Error ? error.message : error);
    const status = error instanceof StoreError ? error.status : configurationError ? 503 : 500;
    const message = configurationError
      ? error instanceof Error && error.message.includes("AUTH_CODE_SECRET")
        ? "Настройте AUTH_CODE_SECRET в backend .env."
        : error instanceof Error ? error.message : "Проверьте настройки SMTP."
      : error instanceof StoreError ? error.message : "Не удалось начать регистрацию. Проверьте данные и настройки сервера.";
    const response = { error: message, ...(registrationPending ? { requiresVerification: true } : {}) };
    return NextResponse.json(response, { status });
  }
}
