"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { CartProduct } from "@/components/store-provider";
import { formatTjs } from "@/lib/currency";
import { ProductThumb } from "@/components/product-image";
import { productImageSrc } from "@/lib/product-images";

export function SearchBox({ onSearch }: { onSearch?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; products: CartProduct[]; error?: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(search)}&limit=5`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Не удалось выполнить поиск.");
          return response.json() as Promise<{ products: CartProduct[] }>;
        })
        .then((data) => {
          setResult({ query: search, products: data.products });
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setResult({ query: search, products: [], error: reason instanceof Error ? reason.message : "Ошибка поиска." });
        })
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = query.trim();
    if (!search) return;
    setOpen(false);
    onSearch?.();
    router.push(`/search?q=${encodeURIComponent(search)}`);
  }

  const currentResult = result?.query === query.trim() ? result : null;
  const searching = query.trim().length >= 2 && !currentResult;

  return (
    <form onSubmit={submit} className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
      <input
        value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        placeholder="Поиск камер и оборудования"
        aria-label="Поиск товаров"
        autoComplete="off"
        className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:bg-slate-800 [color-scheme:light] dark:[color-scheme:dark]"
      />
      <button type="submit" aria-label="Искать" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-500">
        <Search className="h-4 w-4" />
      </button>
      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {currentResult?.error ? <p className="px-3 py-2 text-sm text-rose-600">{currentResult.error}</p> : null}
          {!currentResult?.error && searching ? <p className="px-3 py-2 text-sm text-slate-500">Ищем товары…</p> : null}
          {!currentResult?.error && !searching && currentResult?.products.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">Ничего не найдено</p> : null}
          {currentResult?.products.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              onClick={() => { setOpen(false); onSearch?.(); }}
              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ProductThumb src={product.image ? productImageSrc(product.image) : ""} size={44} rounded="rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-white">{product.name}</span>
                <span className="block text-xs text-violet-600 dark:text-violet-300">{formatTjs(product.price)}</span>
              </span>
            </Link>
          ))}
          <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10">
            Все результаты поиска
          </button>
        </div>
      ) : null}
    </form>
  );
}
