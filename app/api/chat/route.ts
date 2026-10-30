import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { requireUser } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";
import { chatRateLimit, getVisitorThread, postVisitorMessage } from "@/lib/chat";
import { sendContactNotice } from "@/lib/telegram";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: unknown, fallback: string) {
  if (error && !(error instanceof StoreError)) console.error("Chat API error:", error);
  return NextResponse.json({ error: error instanceof StoreError ? error.message : fallback }, { status: error instanceof StoreError ? error.status : 500, headers: NO_STORE });
}

/** GET /api/chat?threadId=…&token=…&read=1 — переписка посетителя (опрос каждые несколько секунд). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const threadId = (url.searchParams.get("threadId") || "").slice(0, 100);
    const token = (url.searchParams.get("token") || "").slice(0, 200);
    if (!threadId || !token) throw new StoreError("Чат не найден.", 404);
    return NextResponse.json(await getVisitorThread(threadId, token, { read: url.searchParams.get("read") === "1" }), { headers: NO_STORE });
  } catch (error) {
    return fail(error, "Не удалось загрузить чат.");
  }
}

/** POST /api/chat — { threadId?, token?, name?, phone?, text }. Без threadId начинает новую переписку. */
export async function POST(request: Request) {
  try {
    let body: { threadId?: string; token?: string; name?: string; phone?: string; text?: string } = {};
    try { body = (await request.json()) as typeof body; } catch { throw new StoreError("Некорректный запрос.", 400); }
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
    chatRateLimit(`chat:${body.threadId || ip}`);

    let userId: string | null = null;
    if (getBearerToken(request.headers.get("authorization"))) {
      try { userId = (await requireUser(request)).id; } catch { /* недействительная сессия — отправляем как гость */ }
    }
    const result = await postVisitorMessage({
      threadId: body.threadId ? String(body.threadId).slice(0, 100) : undefined,
      token: body.token ? String(body.token).slice(0, 200) : undefined,
      name: body.name, phone: body.phone, userId, body: String(body.text ?? ""),
    });
    // Уведомление админу в Telegram (если настроено) — сбой не отменяет сохранённое сообщение.
    void sendContactNotice({ name: String(body.name || "Чат HASI").slice(0, 200), email: "", phone: String(body.phone || "—").slice(0, 100), message: String(body.text ?? "").slice(0, 2000), messageId: result.messageId }).catch(() => {});
    return NextResponse.json({ success: true, ...result }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return fail(error, "Не удалось отправить сообщение.");
  }
}
