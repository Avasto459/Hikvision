import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true, message: "Вы вышли из аккаунта." });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(request), maxAge: 0 });
  return response;
}
