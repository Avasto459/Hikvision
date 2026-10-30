import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db/db";
import { initializeDatabase } from "@/lib/db/seed";
import { StoreError, updateOrderStatus } from "@/lib/db";

type AdminOrderLine = { id: string; name: string; sku: string; unitPrice: number; quantity: number; lineTotal: number };
type AdminOrder = {
  id: string; orderNumber: string | null; kind: "order" | "request"; userId: string | null;
  firstName: string; lastName: string; phone: string; address: string; city: string; email: string;
  comment: string; total: number; status: string; createdAt: string; items: AdminOrderLine[];
};
const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? "" : String(v));
function linesOf(rows: unknown[], orderId: string): AdminOrderLine[] {
  return (rows as Array<Record<string, unknown>>).filter((r) => String(r.orderId) === orderId).map((r) => ({
    id: str(r.id), name: str(r.name), sku: str(r.sku), unitPrice: num(r.unitPrice),
    quantity: num(r.quantity), lineTotal: num(r.lineTotal),
  }));
}
async function loadAdminOrders(): Promise<AdminOrder[]> {
  await initializeDatabase();
  const [auth, guest, authItems, guestItems] = await Promise.all([
    db.execute({ sql: `SELECT * FROM orders ORDER BY datetime(createdAt) DESC` }),
    db.execute({ sql: `SELECT * FROM customer_orders ORDER BY datetime(createdAt) DESC` }),
    db.execute({ sql: `SELECT * FROM orderItems ORDER BY rowid` }),
    db.execute({ sql: `SELECT * FROM order_items ORDER BY rowid` }),
  ]);
  const result: AdminOrder[] = [];
  for (const r of auth.rows as Array<Record<string, unknown>>) {
    const id = str(r.id);
    result.push({ id, orderNumber: r.orderNumber ? str(r.orderNumber) : null, kind: "order",
      userId: r.userId ? str(r.userId) : null, firstName: str(r.firstName), lastName: str(r.lastName),
      phone: str(r.phone), address: str(r.address), city: str(r.city), email: str(r.email),
      comment: str(r.comment), total: num(r.total), status: str(r.status), createdAt: str(r.createdAt),
      items: linesOf(authItems.rows, id) });
  }
  for (const r of guest.rows as Array<Record<string, unknown>>) {
    const id = str(r.id);
    result.push({ id, orderNumber: r.orderNumber ? str(r.orderNumber) : null, kind: "request", userId: null,
      firstName: str(r.customerName), lastName: "", phone: str(r.phone), address: str(r.addressComment),
      city: "", email: "", comment: str(r.addressComment), total: num(r.total), status: str(r.status),
      createdAt: str(r.createdAt), items: linesOf(guestItems.rows, id) });
  }
  result.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return result;
}
const requestStatuses = new Set(["new", "processing", "shipping", "completed", "cancelled", "pending_dealer", "accepted", "issued", "payment_reported", "return_requested"]);
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ orders: await loadAdminOrders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить заказы." }, { status: 500 });
  }
}
export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json() as { orderId?: string; status?: string };
    if (!body.orderId || !body.status) throw new StoreError("Укажите заказ и новый статус.", 400);
    const status = String(body.status);
    const auth = await db.execute({ sql: "SELECT 1 FROM orders WHERE id=?", args: [body.orderId] });
    if (auth.rows.length) { await updateOrderStatus(body.orderId, status); return NextResponse.json({ success: true }); }
    const guest = await db.execute({ sql: "SELECT 1 FROM customer_orders WHERE id=?", args: [body.orderId] });
    if (!guest.rows.length) throw new StoreError("Заказ не найден.", 404);
    if (!requestStatuses.has(status)) throw new StoreError("Недопустимый статус заявки.", 400);
    await db.execute({ sql: "UPDATE customer_orders SET status=? WHERE id=?", args: [status, body.orderId] });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof StoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to update order status:", error);
    return NextResponse.json({ error: "Не удалось изменить заказ." }, { status: 500 });
  }
}

