import Link from "next/link";
import { PartnerCatalog } from "@/components/partner-catalog";
import { SiteShell } from "@/components/site-shell";
import { partnerCatalog } from "@/lib/partner-catalog";
import { requireRole } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Каталог — HASI.TJ" };

/** Первая страница после входа дилера/дистрибьютора: весь ассортимент с фильтрами. */
export default async function PartnerCatalogPage() {
  const account = await requireRole(["DISTRIBUTOR", "DEALER"]);
  const [first, facets] = await Promise.all([partnerCatalog.search({ limit: 24, sort: "popular" }), partnerCatalog.facets()]);
  const role = account.role === "DEALER" ? "DEALER" : "DISTRIBUTOR";
  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <nav aria-label="Разделы кабинета" className="flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-full bg-violet-700 px-4 py-2 text-white">Каталог</span>
          {role === "DEALER" ? <Link href="/distributor/orders" className="rounded-full border border-slate-300 bg-white px-4 py-2 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900">Заявки и заказы</Link> : null}
          <Link href="/distributor/products" className="rounded-full border border-slate-300 bg-white px-4 py-2 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900">＋ Мои товары / Добавить</Link>
        </nav>
        <PartnerCatalog role={role} initialItems={first.items} initialTotal={first.total} facets={facets} />
      </main>
    </SiteShell>
  );
}
