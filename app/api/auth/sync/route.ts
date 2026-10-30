import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { requireUser } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/sync (Authorization: Bearer <hasi-token>)
 * Если пользователь «вошёл» по токену из localStorage, а cookie hasi-session потерялась/истекла,
 * proxy.ts не видит сессию и показывает витрину вместо кабинета. Эндпоинт проверяет токен
 * и заново выставляет cookie — после этого кабинеты открываются по роли.
 */
export async function POST(request: Request) {
  try {
    const token = getBearerToken(request.headers.get("authorization"));
    if (!token) throw new StoreError("Необходим вход в аккаунт.", 401);
    const user = await requireUser(request); // проверка подписи, существования и блокировки
    const response = NextResponse.json({ ok: true, role: user.role });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(request));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof StoreError ? error.message : "Не удалось синхронизировать сессию." }, { status: error instanceof StoreError ? error.status : 500 });
  }
}
