import { NextResponse } from "next/server";
import { getIntegrationValue } from "@/lib/integrations";
import { DEFAULT_TELEGRAM_CHAT_ID } from "@/lib/telegram";
import { saveContactReply } from "@/lib/db";

export const runtime = "nodejs";

/** Telegram webhook: admin replies directly to the notification with Telegram's Reply action. */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = await request.json() as {
      message?: {
        text?: string;
        chat?: { id?: number };
        reply_to_message?: { text?: string; chat?: { id?: number } };
      };
    };
    const message = update.message;
    const reply = message?.text?.trim();
    const original = message?.reply_to_message?.text || "";
    const match = original.match(/\[HASI_CHAT_ID:([a-f\d-]{8,100})\]/i);
    if (!reply || !match) return NextResponse.json({ ok: true, ignored: true });

    const expectedChatId = getIntegrationValue("TELEGRAM_CHAT_ID") || getIntegrationValue("TELEGRAM_ADMIN_CHAT_ID") || DEFAULT_TELEGRAM_CHAT_ID;
    if (String(message?.chat?.id ?? "") !== expectedChatId) {
      return NextResponse.json({ ok: false, error: "Unauthorized Telegram chat" }, { status: 403 });
    }

    const saved = await saveContactReply(match[1], reply);
    if (!saved) return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 });

    const token = getIntegrationValue("TELEGRAM_BOT_TOKEN");
    if (token && message?.chat?.id) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: message.chat.id, text: `✅ Ответ сохранён и появится в чате сайта. ID: ${match[1]}` }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, saved: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
