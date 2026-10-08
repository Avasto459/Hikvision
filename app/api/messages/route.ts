import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { getContactMessagesForVisitor, StoreError } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";

/**
 * POST /api/messages — «Мои обращения». Body: { items: [{ id, token }] }, где пары
 * выдаёт /api/contact при отправке формы и хранит браузер посетителя. Если запрос
 * идёт с Bearer-токеном, дополнительно возвращаются обращения этого аккаунта.
 * Используется виджетом на сайте для периодического опроса (poll).
 */
export async function POST(request: Request) {
  try {
    let body: { items?: Array<{ id?: unknown; token?: unknown }> } = {};
    try {
      body = await request.json() as typeof body;
    } catch {
      // пустое тело допустимо: тогда работаем только по аккаунту
    }
    const items = (Array.isArray(body.items) ? body.items : [])
      .filter((item): item is { id: string; token: string } => typeof item?.id === "string" && typeof item?.token === "string")
      .map((item) => ({ id: item.id.slice(0, 100), token: item.token.slice(0, 200) }));
    const userId = getBearerToken(request.headers.get("authorization")) ? (await requireUser(request)).id : null;
    return NextResponse.json({ messages: await getContactMessagesForVisitor(items, userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Loading visitor messages failed:", error);
    return NextResponse.json({ error: error instanceof StoreError ? error.message : "Не удалось загрузить обращения." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
