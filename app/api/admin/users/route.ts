import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAdminUsers, StoreError } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ users: await getAdminUsers() });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Admin user list failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить пользователей." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
