import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db/db";
import { deleteOrderById, StoreError } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/admin/orders/:id — удаляет заказ и его позиции. Всегда отвечает JSON. */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    if (!id || id.length > 100) throw new StoreError("Некорректный идентификатор заказа.", 400);

    const auth = await db.execute({ sql: "SELECT 1 FROM orders WHERE id=?", args: [id] });
    if (auth.rows.length) {
      await deleteOrderById(id, admin.id);
      return NextResponse.json({ success: true, id, message: "Заказ удалён." });
    }
    const guest = await db.execute({ sql: "SELECT 1 FROM customer_orders WHERE id=?", args: [id] });
    if (!guest.rows.length) throw new StoreError("Заказ не найден.", 404);
    await db.execute({ sql: "DELETE FROM customer_orders WHERE id=?", args: [id] });
    return NextResponse.json({ success: true, id, message: "Заявка удалена." });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Admin order deletion failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof StoreError ? error.message : "Не удалось удалить заказ." },
      { status: error instanceof StoreError ? error.status : 500 },
    );
  }
}
