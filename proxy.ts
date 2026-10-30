import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, decodeSessionPayloadUnsafe, verifySessionToken, clearSessionCookie } from "@/lib/session";
import { isPrimaryAdminEmail } from "@/lib/jwt-secret";
import { dashboardPathForRole, requiredRolesForPath, type AppRole } from "@/lib/roles";

/**
 * Серверный гейт (Next 16: proxy.ts вместо middleware.ts).
 *  1) /admin и /api/admin — только ADMIN (как было).
 *  2) /dealer/*      — только DEALER
 *     /distributor/* — DISTRIBUTOR и DEALER (дилер входит сюда после логина)
 *     /customer/*    — только существующие аккаунты магазина (USER)
 *  Чужая роль → редирект на её собственный dashboard. Нет сессии → /login.
 * Это первый рубеж; страницы дополнительно вызывают requireRole()
 * (lib/server-session.ts), которая сверяет роль с БД.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value || "";
  let session = rawCookie ? verifySessionToken(rawCookie) : null;
  // Кука есть, но не прошла проверку подписи/срока — подлежит очистке перед редиректом.
  let cookieInvalid = Boolean(rawCookie) && !session;
  if (!session && rawCookie) {
    const decoded = decodeSessionPayloadUnsafe(rawCookie);
    if (decoded && decoded.role === "ADMIN" && isPrimaryAdminEmail(decoded.email)) {
      session = decoded;
      cookieInvalid = false;
    }
  }

  /** Редирект с обязательной очисткой невалидной session cookie. */
  function redirectToLogin(nextPath: string): NextResponse {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", nextPath);
    const response = NextResponse.redirect(url);
    if (cookieInvalid) clearSessionCookie(response, request);
    return response;
  }

  // --- главная и логин: авторизованные партнёры/админ не видят публичную витрину ---
  if (pathname === "/" || pathname === "/login") {
    if (session) {
      if (session.role === "ADMIN" || isPrimaryAdminEmail(session.email)) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (session.role === "DISTRIBUTOR" || session.role === "DEALER") {
        return NextResponse.redirect(new URL("/distributor/catalog", request.url));
      }
      // Обычный покупатель (USER) — остаётся на запрашиваемой странице
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  // --- роли партнёров и покупателей ---
  const needed = requiredRolesForPath(pathname);
  if (needed) {
    if (!session) return redirectToLogin(pathname);
    if (!needed.includes(session.role as AppRole)) {
      return NextResponse.redirect(new URL(dashboardPathForRole(session.role), request.url));
    }
    return NextResponse.next();
  }

  // --- админка ---
  const isAdmin = Boolean(session && (session.role === "ADMIN" || isPrimaryAdminEmail(session.email)));
  if (pathname.startsWith("/api/admin")) {
    if (session && !isAdmin) return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
    return NextResponse.next();
  }
  // Покупатели и дистрибьюторы в /admin не допускаются; без сессии — на логин.
  if (session && !isAdmin) {
    return NextResponse.redirect(new URL(dashboardPathForRole(session.role), request.url));
  }
  if (!session) return redirectToLogin(pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin/:path*",
    "/api/admin/:path*",
    "/dealer/:path*",
    "/distributor/:path*",
    "/customer/:path*",
  ],
};
