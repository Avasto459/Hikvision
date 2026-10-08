import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { deleteActivityLog, StoreError } from "@/lib/db";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await deleteActivityLog(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось удалить запись." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
