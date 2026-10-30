import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";
import { listAdminThreads } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** GET /api/admin/chat — список переписок (новые сверху) и число непрочитанных. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const threads = await listAdminThreads();
    return NextResponse.json({ threads, unread: threads.reduce((n, t) => n + t.adminUnread, 0) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Admin chat list failed:", error);
    return NextResponse.json({ error: error instanceof StoreError ? error.message : "Не удалось загрузить чаты." }, { status: error instanceof StoreError ? error.status : 500 });
  }
}
