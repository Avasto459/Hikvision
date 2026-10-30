import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTrackingMap } from "@/components/order-tracking-map";
import { SiteShell } from "@/components/site-shell";
import { findOrderForTracking } from "@/lib/order-lookup";
import { requireRole } from "@/lib/server-session";
import { getTrackingView } from "@/lib/tracking-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Отслеживание заказа — HASI.TJ" };

export default async function TrackOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const account = await requireRole(["USER", "ADMIN", "DEALER", "DISTRIBUTOR"]);
  const order = await findOrderForTracking(orderId);
  // Чужой заказ неотличим от несуществующего.
  if (!order || (account.role !== "ADMIN" && order.userId !== account.id)) notFound();
  const tracking = await getTrackingView(order);

  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-[#050b1c] via-[#0a1230] to-[#050b1c]">
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <Link href="/account" className="mb-4 inline-block text-sm font-semibold text-amber-300 hover:underline">← Мои заказы</Link>
          <OrderTrackingMap
            isAdmin={account.role === "ADMIN"}
            initial={tracking}
            order={{
              id: order.id, orderNumber: order.orderNumber, address: order.address, city: order.city,
              total: order.total, createdAt: order.createdAt,
              items: order.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, lineTotal: i.lineTotal })),
            }}
          />
        </main>
      </div>
    </SiteShell>
  );
}
