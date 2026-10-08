import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { deleteOrderById, StoreError } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/admin/orders/:id — удаляет заказ и его позиции. Всегда отвечает JSON. */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    if (!id || id.length > 100) throw new StoreError("Некорректный идентификатор заказа.", 400);
    await deleteOrderById(id, admin.id);
    return NextResponse.json({ success: true, id, message: "Заказ удалён." });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Admin order deletion failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof StoreError ? error.message : "Не удалось удалить заказ." },
      { status: error instanceof StoreError ? error.status : 500 },
    );
  }
}
