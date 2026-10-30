import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";
import { findOrderForTracking } from "@/lib/order-lookup";
import { getTrackingView } from "@/lib/tracking-server";

export const dynamic = "force-dynamic";

/** Состояние отслеживания: только владелец заказа или администратор. */
export async function GET(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await requireUser(request);
    const { orderId } = await ctx.params;
    const order = await findOrderForTracking(orderId);
    if (!order || (user.role !== "ADMIN" && order.userId !== user.id)) throw new StoreError("Заказ не найден.", 404);
    return NextResponse.json({ tracking: await getTrackingView(order) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Track order:", error);
    return NextResponse.json({ error: "Не удалось загрузить данные заказа." }, { status: 500 });
  }
}
