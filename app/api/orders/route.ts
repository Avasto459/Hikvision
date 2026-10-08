import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { createOrder, getUserOrders, StoreError, type CheckoutItem } from "@/lib/db";
import { normalizeTajikPhone } from "@/lib/phone";
import { sendNewOrderNotice } from "@/lib/telegram";
import { requireUser } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ orders: await getUserOrders(user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить заказы." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
      city?: string;
      comment?: string;
      email?: string;
      items?: CheckoutItem[];
    };
    for (const [label, value] of [
      ["Имя", body.firstName],
      ["Фамилия", body.lastName],
      ["Телефон", body.phone],
      ["Адрес", body.address],
      ["Город", body.city],
    ] as const) {
      if (!value?.trim()) throw new StoreError(`Поле «${label}» обязательно.`, 400);
      if (value.length > 200) throw new StoreError(`Поле «${label}» слишком длинное.`, 400);
    }
    if ((body.comment || "").length > 1000) throw new StoreError("Комментарий слишком длинный.", 400);
    const email = body.email?.trim().toLowerCase() || "";
    const phone = normalizeTajikPhone(body.phone || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError("Укажите корректный email.", 400);
    if (!phone) throw new StoreError("Укажите телефон в формате +992XXXXXXXXX.", 400);
    if (!Array.isArray(body.items) || body.items.length > 100) throw new StoreError("Корзина пуста или содержит слишком много товаров.", 400);

    let userId: string | null = null;
    const token = getBearerToken(request.headers.get("authorization"));
    if (token) {
      try {
        userId = (await requireUser(request)).id;
      } catch (error) {
        if (error instanceof StoreError) throw error;
        throw new StoreError("Сессия недействительна. Войдите снова или оформите заказ без аккаунта.", 401);
      }
    }
    const order = await createOrder({
      userId,
      email,
      firstName: body.firstName!.trim(),
      lastName: body.lastName!.trim(),
      phone,
      address: body.address!.trim(),
      city: body.city!.trim(),
      comment: body.comment?.trim() || "",
      items: body.items,
    });
    if (!order) throw new StoreError("Не удалось оформить заказ.", 500);
    // Уведомление в Telegram — строго после сохранения заказа; его сбой
    // (бот заблокирован, чат не найден, нет сети) не должен ломать оформление.
    try {
      await sendNewOrderNotice({
        orderNumber: order.orderNumber || order.id,
        firstName: body.firstName!.trim(),
        lastName: body.lastName!.trim(),
        phone,
        email,
        city: body.city!.trim(),
        address: body.address!.trim(),
        comment: body.comment?.trim() || "",
        total: order.total,
        items: order.items,
      });
    } catch (error) {
      console.error("Telegram order notification failed:", error instanceof Error ? error.message : error);
    }
    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      message: "Заказ успешно оформлен!",
    }, { status: 201 });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Order creation failed:", error);
    return NextResponse.json(
      { error: error instanceof StoreError ? error.message : "Не удалось оформить заказ. Повторите попытку или свяжитесь с магазином." },
      { status: error instanceof StoreError ? error.status : 500 },
    );
  }
}
