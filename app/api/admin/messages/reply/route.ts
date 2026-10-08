import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { replyToContactMessage } from "@/lib/contact-reply";
import { StoreError } from "@/lib/db";

/**
 * POST /api/admin/messages/reply
 * Body: { messageId: string, replyText: string }
 * Сохраняет ответ (replyText, repliedAt, isReplied = true, статус «Отвечено»).
 * Автор видит ответ на сайте в «Моих обращениях» при ближайшем опросе /api/messages.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    let body: { messageId?: string; replyText?: string };
    try {
      body = await request.json() as { messageId?: string; replyText?: string };
    } catch {
      throw new StoreError("Некорректный запрос: передайте JSON с messageId и replyText.", 400);
    }
    const messageId = body.messageId?.trim() || "";
    if (!messageId || messageId.length > 100) throw new StoreError("Укажите messageId.", 400);
    const result = await replyToContactMessage(messageId, body.replyText || "");
    return NextResponse.json({ success: true, message: "Ответ отправлен на сайт", ...result });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Admin message reply failed:", error);
    const message = error instanceof StoreError ? error.message : "Не удалось отправить ответ.";
    return NextResponse.json({ success: false, error: message, message }, { status: error instanceof StoreError ? error.status : 500 });
  }
}
