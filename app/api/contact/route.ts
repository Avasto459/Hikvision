import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { requireUser } from "@/lib/api-auth";
import { saveContactMessage, StoreError } from "@/lib/db";
import { getEmailConfigurationError, sendContactAutoReply } from "@/lib/email";
import { sendContactNotice } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; phone?: string; message?: string };
    if (!body.name?.trim() || !body.phone?.trim() || !body.message?.trim()) {
      throw new StoreError("Заполните имя, телефон и сообщение.", 400);
    }
    const email = body.email?.trim().toLowerCase() || "";
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new StoreError("Укажите корректный email или оставьте поле пустым.", 400);
    }
    if (body.name.length > 200 || body.phone.length > 100 || body.message.length > 2000) {
      throw new StoreError("Проверьте длину введённых данных.", 400);
    }

    // Если посетитель вошёл в аккаунт — привязываем обращение к нему (виден в «Моих обращениях» на любом устройстве).
    let userId: string | null = null;
    if (getBearerToken(request.headers.get("authorization"))) {
      try { userId = (await requireUser(request)).id; } catch { /* недействительная сессия — отправляем как гость */ }
    }

    // 1) Главное: сохранение в БД.
    const result = await saveContactMessage({ name: body.name, email, phone: body.phone, message: body.message, userId });

    // 2) Побочные уведомления: каждое в своём try/catch, сбой любого не отменяет сохранённое обращение.
    const contact = { name: body.name.trim(), email, phone: body.phone.trim(), message: body.message.trim() };
    await Promise.allSettled([
      sendContactNotice(contact),
      (async () => {
        if (!email || getEmailConfigurationError()) return; // нет адреса или SMTP не настроен
        try {
          await sendContactAutoReply(email, contact.name);
        } catch (error) {
          console.error("Contact auto-reply failed:", error instanceof Error ? error.message : error);
        }
      })(),
    ]);

    return NextResponse.json({
      success: true,
      id: result.id,
      visitorToken: result.visitorToken,
      message: "Сообщение отправлено. Мы свяжемся с вами.",
    }, { status: 201 });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Contact message failed:", error);
    return NextResponse.json({ error: error instanceof StoreError ? error.message : "Не удалось отправить сообщение." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
