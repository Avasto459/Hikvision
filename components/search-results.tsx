"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { SiteShell } from "@/components/site-shell";
import type { Product } from "@/lib/db";

type SearchProduct = Product & { categorySlug: string; categoryName: string };

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [completedQuery, setCompletedQuery] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products?search=${encodeURIComponent(query)}&limit=100`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить результаты поиска.");
        return response.json() as Promise<{ products: SearchProduct[] }>;
      })
      .then((result) => {
        setProducts(result.products);
        setError("");
        setCompletedQuery(query);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Ошибка поиска.");
        setCompletedQuery(query);
      })
    return () => controller.abort();
  }, [query]);

  const loading = completedQuery !== query;

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/catalog" className="text-sm text-violet-700 hover:underline">← Каталог</Link>
        <h1 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">Результаты поиска</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Запрос: «{query}»</p>
        {loading ? <p className="mt-8 text-slate-500">Ищем товары…</p> : null}
        {!loading && error ? <p role="alert" className="mt-8 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p> : null}
        {!loading && !error && products.length === 0 ? <p className="mt-8 rounded-2xl bg-white p-6 text-slate-600 dark:bg-slate-900 dark:text-slate-300">Ничего не найдено. Попробуйте изменить поисковый запрос.</p> : null}
        {!loading && !error && products.length > 0 ? <p className="mt-3 text-sm text-slate-500">Найдено товаров: {products.length}</p> : null}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </SiteShell>
  );
}
