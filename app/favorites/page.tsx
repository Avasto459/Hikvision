"use client";

import Link from "next/link";
import { useCart } from "@/components/store-provider";
import { ProductCard } from "@/components/product-card";
import { SiteShell } from "@/components/site-shell";

export default function FavoritesPage() {
  const { favorites, ready } = useCart();
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Избранное</h1>
        {!ready ? <p className="mt-6 text-slate-500">Загружаем избранное…</p> : favorites.length ? (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{favorites.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        ) : (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-300">Пока нет сохранённых товаров.</p>
            <Link href="/catalog" className="mt-4 inline-flex rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white">Открыть каталог</Link>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
