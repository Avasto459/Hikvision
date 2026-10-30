import { NextResponse } from "next/server";
import { findGuestOrder } from "@/lib/order-lookup";
import { getTrackingView } from "@/lib/tracking-server";

export const dynamic = "force-dynamic";

/** Простое ограничение попыток по IP (в памяти процесса): защита от подбора номеров заказов. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function limited(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (attempts.size > 5000) for (const [key, value] of attempts) if (value.resetAt < now) attempts.delete(key);
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

/** Публичное отслеживание гостем: номер заказа + телефон. Чужие данные без обоих совпадений не раскрываются. */
export async function POST(request: Request) {
  try {
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
    if (limited(ip)) return NextResponse.json({ error: "Слишком много попыток. Повторите через несколько минут." }, { status: 429 });
    const body = (await request.json().catch(() => null)) as { orderNumber?: unknown; phone?: unknown } | null;
    const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber : "";
    const phone = typeof body?.phone === "string" ? body.phone : "";
    if (!orderNumber.trim() || !phone.trim()) return NextResponse.json({ error: "Укажите номер заказа и телефон." }, { status: 400 });
    const order = await findGuestOrder(orderNumber, phone);
    // Одинаковый ответ на «нет заказа» и «неверный телефон».
    if (!order) return NextResponse.json({ error: "Заказ не найден. Проверьте номер заказа и телефон." }, { status: 404 });
    return NextResponse.json({
      order: {
        id: order.id, orderNumber: order.orderNumber, address: order.address, city: order.city, total: order.total,
        createdAt: order.createdAt, items: order.items,
      },
      tracking: await getTrackingView(order),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Guest tracking:", error);
    return NextResponse.json({ error: "Не удалось загрузить данные заказа." }, { status: 500 });
  }
}
