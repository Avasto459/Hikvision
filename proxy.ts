import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, decodeSessionPayloadUnsafe, verifySessionToken } from "@/lib/session";
import { isPrimaryAdminEmail } from "@/lib/jwt-secret";

/**
 * П.4 — серверный гейт админки. Валидирует JWT из Cookie напрямую,
 * без обращения к БД (verify — только подпись + срок).
 *
 * - email najmiddinovavasto5@gmail.com ИЛИ role === 'ADMIN' => пропуск
 *   на /admin и /api/admin без «Сессия недействительна» / «Необходим вход».
 * - Известный НЕ-админ на /api/admin => 403, на /admin => редирект /account.
 * - Без куки: /admin отдаём дальше (клиентский JWT-fallback решит),
 *   /api/admin отдаём дальше (requireAdmin в хендлере проверит Bearer).
 * - Edge: jsonwebtoken node-only — при броске до проверки подписи
 *   мягкий fallback decodeSessionPayloadUnsafe только для главного админа.
 */
export function proxy(request: NextRequest) {
  const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value || "";
  let session = rawCookie ? verifySessionToken(rawCookie) : null;
  if (!session && rawCookie) {
    // Edge не смог проверить подпись (node-only зависимость) —
    // мягкий fallback только для главного админа.
    const decoded = decodeSessionPayloadUnsafe(rawCookie);
    if (decoded && decoded.role === "ADMIN" && isPrimaryAdminEmail(decoded.email)) {
      session = decoded;
    }
  }
  // П.4: email главного админа ИЛИ role admin => беспрепятственный доступ.
  const isAdmin = Boolean(
    session && (session.role === "ADMIN" || isPrimaryAdminEmail(session.email)),
  );

  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    if (session && !isAdmin) {
      return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (session && !isAdmin) {
    return NextResponse.redirect(new URL("/account", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
