import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-ui";
import { DistributorProductForm } from "@/components/distributor-product-form";
import { SiteShell } from "@/components/site-shell";
import { requireRole } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мои товары — HASI.TJ" };

export default async function DistributorProductsPage() {
  const account = await requireRole(["DISTRIBUTOR", "DEALER"]);
  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <DashboardHeader title="Мои товары" subtitle={account.email} badge={account.role === "DEALER" ? "Дилер" : "Дистрибьютор"} />
        {account.role === "DEALER" ? <Link href="/distributor/orders" className="inline-block text-sm font-semibold text-violet-700 hover:underline">← Заявки и заказы</Link> : null}
        <DistributorProductForm distributorName={account.name || account.email} />
      </main>
    </SiteShell>
  );
}
