import { db } from "@/lib/db/db";
import { getUserOrders } from "@/lib/db";
import { initializeSchema } from "@/lib/db/schema";
import { normalizeTajikPhone } from "@/lib/phone";

/** Единый вид заказа для личного кабинета и отслеживания (две таблицы: orders и customer_orders). */
export type UnifiedOrder = {
  id: string;
  orderNumber: string;
  userId: string | null;
  kind: "order" | "request";
  status: string; // new | processing | shipping | completed | cancelled
  total: number;
  createdAt: string;
  phone: string;
  city: string;
  address: string;
  items: { id: string; name: string; quantity: number; lineTotal: number }[];
};

const STAGES = new Set(["new", "processing", "shipping", "completed", "cancelled"]);

/** Статусы дилерской заявки → отображаемые статусы покупателя. */
function mapRequestStatus(status: string): string {
  switch (status) {
    case "pending_dealer": return "new";
    case "cancelled": case "canceled": return "cancelled";
    case "issued": case "payment_reported": case "settled": case "return_requested": return "completed";
    default: return "processing"; // accepted и прочие промежуточные
  }
}

function str(v: unknown) { return v === null || v === undefined ? "" : String(v); }

async function requestItems(orderId: string) {
  const r = await db.execute({ sql: "SELECT id,name,quantity,lineTotal FROM order_items WHERE orderId=? ORDER BY rowid", args: [orderId] });
  return r.rows.map((x) => ({ id: str(x.id), name: str(x.name), quantity: Number(x.quantity), lineTotal: Number(x.lineTotal) }));
}

async function toRequest(x: Record<string, unknown>): Promise<UnifiedOrder> {
  const id = str(x.id);
  const t = await db.execute({ sql: "SELECT stage FROM order_tracking WHERE orderId=? LIMIT 1", args: [id] });
  const stage = str(t.rows[0]?.stage);
  const base = mapRequestStatus(str(x.status));
  return {
    id, orderNumber: str(x.orderNumber), userId: x.userId ? str(x.userId) : null, kind: "request",
    status: base !== "cancelled" && STAGES.has(stage) ? stage : base,
    total: Number(x.total), createdAt: str(x.createdAt), phone: str(x.phone), city: "", address: str(x.addressComment),
    items: await requestItems(id),
  };
}

/** Все заказы вошедшего покупателя: старые (orders) + оформленные через корзину (customer_orders), новые сверху. */
export async function listUserOrders(userId: string): Promise<UnifiedOrder[]> {
  await initializeSchema();
  const legacy = (await getUserOrders(userId)).map<UnifiedOrder>((o) => ({
    id: o.id, orderNumber: o.orderNumber || o.id.slice(0, 8), userId: o.userId, kind: "order", status: o.status,
    total: o.total, createdAt: o.createdAt, phone: o.phone, city: o.city, address: o.address,
    items: o.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, lineTotal: i.lineTotal })),
  }));
  const r = await db.execute({ sql: "SELECT * FROM customer_orders WHERE userId=? ORDER BY datetime(createdAt) DESC", args: [userId] });
  const requests = await Promise.all((r.rows as Array<Record<string, unknown>>).map(toRequest));
  return [...legacy, ...requests].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Заказ по id из любой таблицы (для страницы отслеживания). */
export async function findOrderForTracking(id: string): Promise<UnifiedOrder | null> {
  await initializeSchema();
  const legacy = await db.execute({ sql: "SELECT * FROM orders WHERE id=? LIMIT 1", args: [id] });
  if (legacy.rows[0]) {
    const o = legacy.rows[0] as Record<string, unknown>;
    const items = await db.execute({ sql: "SELECT id,name,quantity,lineTotal FROM orderItems WHERE orderId=? ORDER BY rowid", args: [id] });
    const t = await db.execute({ sql: "SELECT stage FROM order_tracking WHERE orderId=? LIMIT 1", args: [id] });
    const stage = str(t.rows[0]?.stage);
    return {
      id, orderNumber: str(o.orderNumber) || id.slice(0, 8), userId: o.userId ? str(o.userId) : null, kind: "order",
      status: STAGES.has(stage) ? stage : str(o.status),
      total: Number(o.total), createdAt: str(o.createdAt), phone: str(o.phone), city: str(o.city), address: str(o.address),
      items: items.rows.map((x) => ({ id: str(x.id), name: str(x.name), quantity: Number(x.quantity), lineTotal: Number(x.lineTotal) })),
    };
  }
  const req = await db.execute({ sql: "SELECT * FROM customer_orders WHERE id=? LIMIT 1", args: [id] });
  return req.rows[0] ? toRequest(req.rows[0] as Record<string, unknown>) : null;
}

/** Гостевой поиск: номер заказа + телефон (должны совпасть оба). */
export async function findGuestOrder(orderNumber: string, phoneRaw: string): Promise<UnifiedOrder | null> {
  const phone = normalizeTajikPhone(phoneRaw);
  const number = orderNumber.trim().toUpperCase();
  if (!phone || !number || number.length > 40) return null;
  await initializeSchema();
  const r = await db.execute({ sql: "SELECT * FROM customer_orders WHERE upper(orderNumber)=? LIMIT 1", args: [number] });
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (row && normalizeTajikPhone(str(row.phone)) === phone) return toRequest(row);
  const l = await db.execute({ sql: "SELECT id,phone FROM orders WHERE upper(orderNumber)=? LIMIT 1", args: [number] });
  const legacy = l.rows[0];
  if (legacy && normalizeTajikPhone(str(legacy.phone)) === phone) return findOrderForTracking(str(legacy.id));
  return null;
}
