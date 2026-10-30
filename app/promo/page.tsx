import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { PromoBanner } from "@/components/promo-banner";
import { SiteShell } from "@/components/site-shell";
import { getDealProducts } from "@/lib/db";
import { getActivePromos } from "@/lib/promos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Акции и скидки — HASI.TJ" };

/** Все акционные товары магазина: прежняя цена выше текущей. */
export default async function PromoPage() {
  const [products, promos] = await Promise.all([getDealProducts(24), getActivePromos()]);
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {promos.length ? <PromoBanner deals={[]} promos={promos} /> : null}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-600 dark:text-amber-300">Акции</p>
            <h1 className="mt-1 text-3xl font-black">Товары по акции ({products.length})</h1>
          </div>
          <Link href="/catalog" className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">Весь каталог →</Link>
        </div>
        {products.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => <ProductCard key={product.id} product={product} favorite cart />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Сейчас акционных товаров нет. Загляните позже.</p>
        )}
      </section>
    </SiteShell>
  );
}
