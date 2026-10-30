import { NextResponse } from "next/server";
import { signToken } from "@/lib/auth";
import { getPublicUser, getUserDisplayName, StoreError, verifyRegistrationCode } from "@/lib/db";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; code?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const code = body.code?.trim() || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      throw new StoreError("Укажите email и шестизначный код из письма.", 400);
    }
    const user = await verifyRegistrationCode(email, code);
    if (!user) throw new StoreError("Не удалось подтвердить email.", 500);
    // П.1 + П.3: авто-авторизация после подтверждения — JWT { id, email, name, role }.
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
      message: "Email успешно подтверждён.",
      token,
      user: publicUser,
    });
    // П.3: httpOnly, path=/, sameSite=lax, secure.
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(request));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось подтвердить email." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
