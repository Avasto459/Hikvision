import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public, whitelisted contact details for the footer. Integration secrets are never exposed here. */
export async function GET() {
  const all = await getSiteSettings();
  return NextResponse.json({
    siteName: all.site_name || "HASI.TJ",
    phone: all.phone || "",
    address: all.address || "",
    about: all.about || "",
  });
}
