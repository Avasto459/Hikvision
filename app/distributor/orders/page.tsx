import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { DashboardHeader } from "@/components/dashboard-ui";
import { DealerPanel } from "@/components/dealer-panel";
import { requireRole } from "@/lib/server-session";
import { getDealerProfile, getDealerFinance } from "@/lib/hasi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявки и заказы — HASI.TJ" };

export default async function DistributorOrdersPage() {
  const account = await requireRole(["DEALER"]);
  const [profile, finance] = await Promise.all([
    getDealerProfile(account.id),
    getDealerFinance(account.id),
  ]);

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <DashboardHeader title="Заявки и заказы" subtitle={account.email} badge={account.role === "DEALER" ? "Дилер" : "Дистрибьютор"} />
        <Link href="/distributor/products" className="inline-flex rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-600">＋ Добавить товар</Link>
        <DealerPanel profile={profile} initialFinance={finance} initialTab="free" />
      </main>
    </SiteShell>
  );
}