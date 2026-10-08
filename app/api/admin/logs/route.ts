import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { clearActivityLogs, StoreError } from "@/lib/db";

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ success: true, deleted: await clearActivityLogs() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось очистить историю." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
