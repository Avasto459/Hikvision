export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { comparePassword } from "@/lib/auth";
import { deleteOwnAccount, updateUserProfile, getUserById, getUserByPhone, StoreError, getPublicUser } from "@/lib/db";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { requireUser } from "@/lib/api-auth";
import { normalizeTajikPhone } from "@/lib/phone";

export async function GET(request: Request) {
  try {
    const user = await getUserById((await requireUser(request)).id);
    if (!user) throw new StoreError("Пользователь не найден.", 404);
    return NextResponse.json({ user: getPublicUser(user) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить профиль." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось обновить профиль." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
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
    return NextResponse.json({ error: error instanceof StoreError ? error.message : "Не удалось удалить аккаунт." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
