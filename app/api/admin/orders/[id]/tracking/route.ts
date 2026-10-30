import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { StoreError, updateOrderStatus } from "@/lib/db";
import { findOrderForTracking } from "@/lib/order-lookup";
import { db } from "@/lib/db/db";
import { initializeSchema } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function coord(value: unknown, min: number, max: number, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new StoreError(`Некорректное значение: ${label}.`, 400);
  return n;
}

/** Администратор задаёт курьера, координаты, ETA и (по желанию) статус заказа. */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const order = await findOrderForTracking(id);
    if (!order) throw new StoreError("Заказ не найден.", 404);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") throw new StoreError("Некорректные данные.", 400);

    const courierName = String(body.courierName ?? "").trim().slice(0, 80);
    const courierPhone = String(body.courierPhone ?? "").trim();
    if (courierPhone && !/^\+?[0-9\s()-]{5,20}$/.test(courierPhone)) throw new StoreError("Некорректный телефон курьера.", 400);
    const courierLat = coord(body.courierLat, -90, 90, "широта курьера");
    const courierLng = coord(body.courierLng, -180, 180, "долгота курьера");
    const destLat = coord(body.destLat, -90, 90, "широта адреса");
    const destLng = coord(body.destLng, -180, 180, "долгота адреса");
    if ((courierLat === null) !== (courierLng === null)) throw new StoreError("Укажите обе координаты курьера.", 400);
    if ((destLat === null) !== (destLng === null)) throw new StoreError("Укажите обе координаты адреса.", 400);
    const eta = body.etaMinutes === undefined || body.etaMinutes === "" || body.etaMinutes === null ? null : Number(body.etaMinutes);
    if (eta !== null && (!Number.isInteger(eta) || eta < 0 || eta > 7 * 24 * 60)) throw new StoreError("Время в пути — целое число минут.", 400);

    const STAGES = ["new", "processing", "shipping", "completed", "cancelled"];
    const wanted = typeof body.status === "string" ? body.status : "";
    if (wanted && !STAGES.includes(wanted)) throw new StoreError("Недопустимый статус.", 400);
    // Для заказов-заявок (через корзину) «стадия доставки» хранится в order_tracking; у обычных заказов — в orders.status.
    const stage = order.kind === "request" && wanted ? wanted : null;

    await initializeSchema();
    const now = new Date();
    const prevRow = (await db.execute({ sql: "SELECT * FROM order_tracking WHERE orderId=? LIMIT 1", args: [id] })).rows[0];
    const keepNum = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
    // Пустое поле формы = «не менять»: иначе сохранение одного статуса стирало бы курьера и координаты.
    const mergedName = courierName || String(prevRow?.courierName || "");
    const mergedPhone = courierPhone || String(prevRow?.courierPhone || "");
    const mergedCLat = courierLat ?? keepNum(prevRow?.courierLat);
    const mergedCLng = courierLng ?? keepNum(prevRow?.courierLng);
    const mergedDLat = destLat ?? keepNum(prevRow?.destLat);
    const mergedDLng = destLng ?? keepNum(prevRow?.destLng);
    // Переход в «В пути» начинает новый рейс: старт — сейчас, старое прибытие сбрасывается.
    const entering = wanted === "shipping" && order.status !== "shipping";
    let startedAt: string | null = prevRow?.startedAt ? String(prevRow.startedAt) : null;
    let etaAt: string | null = prevRow?.etaAt ? String(prevRow.etaAt) : null;
    if (entering) { startedAt = now.toISOString(); etaAt = null; }
    else if (wanted === "shipping" && !startedAt) startedAt = now.toISOString();
    if (eta !== null) etaAt = new Date(now.getTime() + eta * 60000).toISOString();
    if (wanted && wanted !== "shipping" && wanted !== "completed") { startedAt = null; etaAt = null; }

    await db.execute({
      sql: `INSERT INTO order_tracking(orderId,courierName,courierPhone,courierLat,courierLng,destLat,destLng,startedAt,etaAt,updatedAt,stage)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(orderId) DO UPDATE SET courierName=excluded.courierName, courierPhone=excluded.courierPhone,
              courierLat=excluded.courierLat, courierLng=excluded.courierLng, destLat=excluded.destLat, destLng=excluded.destLng,
              startedAt=excluded.startedAt, etaAt=excluded.etaAt, updatedAt=excluded.updatedAt,
              stage=COALESCE(excluded.stage, order_tracking.stage)`,
      args: [id, mergedName, mergedPhone, mergedCLat, mergedCLng, mergedDLat, mergedDLng, startedAt, etaAt, now.toISOString(), stage],
    });
    if (order.kind === "order" && wanted && wanted !== order.status) await updateOrderStatus(id, wanted);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Admin tracking:", error);
    return NextResponse.json({ error: "Не удалось сохранить данные доставки." }, { status: 500 });
  }
}

/** PATCH { lat, lng } — «живой» GPS курьера: меняет только координаты курьера (шлёт телефон курьера/админа). */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const order = await findOrderForTracking(id);
    if (!order) throw new StoreError("Заказ не найден.", 404);
    const body = (await request.json().catch(() => null)) as { lat?: unknown; lng?: unknown } | null;
    const lat = coord(body?.lat, -90, 90, "широта");
    const lng = coord(body?.lng, -180, 180, "долгота");
    if (lat === null || lng === null) throw new StoreError("Передайте lat и lng.", 400);
    await initializeSchema();
    const ts = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO order_tracking(orderId,courierLat,courierLng,updatedAt) VALUES(?,?,?,?)
            ON CONFLICT(orderId) DO UPDATE SET courierLat=excluded.courierLat, courierLng=excluded.courierLng, updatedAt=excluded.updatedAt`,
      args: [id, lat, lng, ts],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Admin tracking GPS:", error);
    return NextResponse.json({ error: "Не удалось сохранить GPS." }, { status: 500 });
  }
}
