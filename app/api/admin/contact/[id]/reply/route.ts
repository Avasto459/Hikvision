import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { replyToContactMessage } from "@/lib/contact-reply";
import { StoreError } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

/** Прежний адрес ответа — делегирует тому же коду, что и /api/admin/messages/reply. */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json() as { reply?: string; replyText?: string };
    const result = await replyToContactMessage(id, body.replyText ?? body.reply ?? "");
    return NextResponse.json({ success: true, message: "Ответ успешно отправлен", ...result });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Contact reply failed:", error);
    const message = error instanceof StoreError ? error.message : "Не удалось отправить ответ.";
    return NextResponse.json({ success: false, error: message, message }, { status: error instanceof StoreError ? error.status : 500 });
  }
}
