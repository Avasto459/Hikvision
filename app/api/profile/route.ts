export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { comparePassword } from "@/lib/auth";
import { deleteOwnAccount, updateUserProfile, getUserById, getUserByEmail, getUserByPhone, StoreError, getPublicUser } from "@/lib/db";
import { SESSION_COOKIE_NAME, sessionCookieOptions, clearSessionCookie } from "@/lib/session";
import { requireUser } from "@/lib/api-auth";
import { normalizeTajikPhone } from "@/lib/phone";

export async function GET(request: Request) {
  try {
    const session = await requireUser(request);
    let user = await getUserById(session.id);
    // A valid primary-admin token can outlive a DB row recreation on Vercel.
    if (!user && session.email.trim().toLowerCase() === "najmiddinovavasto5@gmail.com") {
      user = await getUserByEmail(session.email);
    }
    if (!user) {
      const response = NextResponse.json({ error: "Сессия больше не действительна. Войдите снова.", redirectTo: "/login", clearToken: true }, { status: 401 });
      response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(request), maxAge: 0 });
      return response;
    }
    return NextResponse.json({ user: getPublicUser(user) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    const invalidSession = status === 401 || status === 404;
    const response = NextResponse.json({ error: invalidSession ? "Сессия недействительна. Войдите снова." : (error instanceof Error ? error.message : "Не удалось загрузить профиль."), ...(invalidSession ? { redirectTo: "/login", clearToken: true } : {}) }, { status: invalidSession ? 401 : status });
    if (invalidSession) response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(request), maxAge: 0 });
    return response;
  }
}

export async function PUT(request: Request) {
  try {
    const userId = (await requireUser(request)).id;
    const body = await request.json() as { firstName?: string; lastName?: string; phone?: string };
    const firstName = body.firstName?.trim() || "";
    const lastName = body.lastName?.trim() || "";
    const phone = normalizeTajikPhone(body.phone || "");
    if (!firstName || !lastName || !phone || firstName.length > 100 || lastName.length > 100) {
      throw new StoreError("Укажите имя, фамилию и корректный номер +992XXXXXXXXX.", 400);
    }
    const existingPhoneUser = await getUserByPhone(phone);
    if (existingPhoneUser && existingPhoneUser.id !== userId) {
      throw new StoreError("Этот телефон уже используется.", 409);
    }

    await updateUserProfile(userId, { firstName, lastName, phone });

    const updatedUser = await getUserById(userId);
    if (!updatedUser) throw new StoreError("Пользователь не найден.", 404);
    return NextResponse.json({ user: getPublicUser(updatedUser) });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Profile update failed:", error);
    const status = error instanceof StoreError ? error.status : 500;
    const invalidSession = status === 401;
    const response = NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось обновить профиль." }, { status });
    if (invalidSession) clearSessionCookie(response, request);
    return response;
  }
}

/** Permanently deletes the signed-in user's account after the password is confirmed. */
export async function DELETE(request: Request) {
  try {
    const userId = (await requireUser(request)).id;
    const user = await getUserById(userId);
    if (!user) throw new StoreError("Пользователь не найден.", 404);
    const body = await request.json().catch(() => ({})) as { password?: string };
    if (!body.password) throw new StoreError("Введите пароль для подтверждения удаления.", 400);
    if (!await comparePassword(body.password, user.passwordHash)) throw new StoreError("Пароль указан неверно.", 401);

    await deleteOwnAccount(userId);
    if (user.avatar?.startsWith("/uploads/avatars/")) {
      const file = path.join(process.cwd(), "public", user.avatar);
      if (file.startsWith(path.join(process.cwd(), "public", "uploads", "avatars"))) await unlink(file).catch(() => undefined);
    }
    const response = NextResponse.json({ success: true, message: "Аккаунт удалён." });
    response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(request), maxAge: 0 });
    return response;
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Account deletion failed:", error);
    const status = error instanceof StoreError ? error.status : 500;
    const invalidSession = status === 401;
    const response = NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось удалить аккаунт." }, { status });
    if (invalidSession) clearSessionCookie(response, request);
    return response;
  }
}
