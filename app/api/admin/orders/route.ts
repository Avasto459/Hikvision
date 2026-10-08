import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getOrders, StoreError, updateOrderStatus } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ orders: await getOrders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить заказы." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json() as { orderId?: string; status?: string };
    if (!body.orderId || !body.status) throw new StoreError("Укажите заказ и новый статус.", 400);
    await updateOrderStatus(body.orderId, body.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось изменить заказ." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
