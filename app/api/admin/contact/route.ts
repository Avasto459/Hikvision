import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getContactMessages, StoreError } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ messages: await getContactMessages() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить сообщения." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
