import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { cancelUserOrder, deleteUserOrder, StoreError } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function fail(error: unknown, fallback: string) {
  if (error && !(error instanceof StoreError)) console.error(fallback, error);
  return NextResponse.json({ error: error instanceof StoreError ? error.message : fallback }, {
    status: error instanceof StoreError ? error.status : 500,
  });
}

/** PATCH { action: "cancel" } — the owner cancels an order that is not completed yet. */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { action?: string };
    if (body.action !== "cancel") throw new StoreError("Неизвестное действие.", 400);
    await cancelUserOrder(user.id, id);
    return NextResponse.json({ success: true, status: "cancelled" });
  } catch (error) {
    return fail(error, "Не удалось отменить заказ.");
  }
}

/** DELETE — the owner removes a cancelled order from their history. */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    await deleteUserOrder(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return fail(error, "Не удалось удалить заказ.");
  }
}
