import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { deleteContactMessage, StoreError, updateContactMessageStatus, type ContactMessageStatus } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function fail(error: unknown, fallback: string) {
  if (error && !(error instanceof StoreError)) console.error(fallback, error);
  return NextResponse.json({ error: error instanceof StoreError ? error.message : fallback }, {
    status: error instanceof StoreError ? error.status : 500,
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json() as { status?: ContactMessageStatus };
    const message = await updateContactMessageStatus(id, body.status as ContactMessageStatus);
    return NextResponse.json({ message });
  } catch (error) {
    return fail(error, "Не удалось изменить сообщение.");
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await deleteContactMessage(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return fail(error, "Не удалось удалить сообщение.");
  }
}
