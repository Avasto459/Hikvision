import { NextResponse } from "next/server";
import { getActivePromos } from "@/lib/promos";

export const dynamic = "force-dynamic";

/** Публичный список активных баннеров. */
export async function GET() {
  return NextResponse.json({ promos: await getActivePromos() }, { headers: { "Cache-Control": "no-store" } });
}
