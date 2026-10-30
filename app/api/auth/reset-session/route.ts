import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/reset-session?next=/login
 * Сбрасывает cookie `hasi-session` и перенаправляет на относительный путь.
 * Нужен для разрыва циклов редиректа: страница не может менять cookie во время
 * рендера, а proxy.ts отправляет обратно всех, у кого cookie формально валидна.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("next") || "/login";
  // Только внутренние пути (защита от open redirect); петлю на сам себя не допускаем.
  const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/api/auth/reset-session") ? raw : "/login";
  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.set("Cache-Control", "no-store");
  return clearSessionCookie(response, request);
}
