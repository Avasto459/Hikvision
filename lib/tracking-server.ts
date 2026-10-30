import { db } from "@/lib/db/db";
import { initializeSchema } from "@/lib/db/schema";
import { SITE_PHONES } from "@/lib/site-contacts";
import { buildTrackingView, type TrackingRow, type TrackingView } from "@/lib/tracking";

const defaults = { courierName: "Курьер HASI", courierPhone: SITE_PHONES[0]?.tel ?? "" };

function num(v: unknown) {
  return v === null || v === undefined || v === "" ? null : Number(v);
}

export async function loadTrackingRow(orderId: string): Promise<TrackingRow | null> {
  await initializeSchema();
  const r = await db.execute({ sql: "SELECT * FROM order_tracking WHERE orderId=? LIMIT 1", args: [orderId] });
  const x = r.rows[0];
  if (!x) return null;
  return {
    courierName: String(x.courierName || ""), courierPhone: String(x.courierPhone || ""),
    courierLat: num(x.courierLat), courierLng: num(x.courierLng), destLat: num(x.destLat), destLng: num(x.destLng),
    startedAt: x.startedAt ? String(x.startedAt) : null, etaAt: x.etaAt ? String(x.etaAt) : null, updatedAt: String(x.updatedAt || ""),
  };
}

export async function getTrackingView(order: { id: string; status: string; city: string; address?: string }): Promise<TrackingView> {
  return buildTrackingView({ id: order.id, status: order.status, city: order.city || order.address || "" }, await loadTrackingRow(order.id), Date.now(), defaults);
}
