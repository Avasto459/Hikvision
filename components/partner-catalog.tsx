"use client";

import { Minus, PackageSearch, Plus, Search, ShoppingCart, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CategoryFilter } from "@/components/category-filter";
import { DealerOrderModal } from "@/components/dealer-order-modal";
import { ProductCard } from "@/components/product-card";
import { formatTjs } from "@/lib/currency";
import type { CatalogFacets, CatalogItem, CatalogSort } from "@/lib/partner-catalog";

type Props = {
  role: "DEALER" | "DISTRIBUTOR";
  initialItems: CatalogItem[];
  initialTotal: number;
  facets: CatalogFacets;
};

const PAGE = 24;
const SORTS: Array<[CatalogSort, string]> = [
  ["popular", "Сначала в наличии"], ["price-asc", "Дешевле"], ["price-desc", "Дороже"], ["name", "По названию"], ["newest", "Новые"],
];

const chip = (active: boolean) =>
  `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${active
    ? "bg-violet-700 text-white shadow-sm"
    : "border border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`;

/** Каталог для кабинета дилера/дистрибьютора: поиск, категории, бренды, сортировка, «показать ещё». Дилер может собирать заказ. */
export function PartnerCatalog({ role, initialItems, initialTotal, facets }: Props) {
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<CatalogSort>("popular");
  const [inStock, setInStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [ordering, setOrdering] = useState(false);
  const [notice, setNotice] = useState("");
  const first = useRef(true);
  const dealer = role === "DEALER";

  const activeParent = useMemo(
    () => facets.categories.find((c) => c.slug === category || c.children.some((x) => x.slug === category)),
    [facets.categories, category],
  );

  const load = useCallback(async (offset: number, replace: boolean, signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ sort, offset: String(offset), limit: String(PAGE) });
      if (q.trim()) params.set("q", q.trim());
      if (brand) params.set("brand", brand);
      if (category) params.set("category", category);
      if (inStock) params.set("inStock", "1");
      const res = await fetch(`/api/partner/catalog?${params}`, { signal, cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { items?: CatalogItem[]; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить каталог.");
      const next = data.items ?? [];
      setItems((cur) => (replace ? next : [...cur, ...next]));
      setTotal(data.total ?? 0);
      setPrices((cur) => ({ ...cur, ...Object.fromEntries(next.map((i) => [i.id, i.price])) }));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "Не удалось загрузить каталог.");
    } finally {
      setLoading(false);
    }
  }, [q, brand, category, sort, inStock]);

  // перезапрос при смене фильтров (поиск — с задержкой 300 мс)
  useEffect(() => {
    if (first.current) { first.current = false; setPrices(Object.fromEntries(initialItems.map((i) => [i.id, i.price]))); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => void load(0, true, controller.signal), q ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, brand, category, sort, inStock]);

  const setQty = (item: CatalogItem, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      const value = Math.max(0, Math.min(qty, item.stock));
      if (value === 0) delete next[item.id]; else next[item.id] = value;
      return next;
    });

  const count = Object.values(cart).reduce((s, n) => s + n, 0);
  const sum = Object.entries(cart).reduce((s, [id, n]) => s + (prices[id] ?? 0) * n, 0);
  const hasFilters = Boolean(q || brand || category || inStock);
  const reset = () => { setQ(""); setBrand(""); setCategory(""); setInStock(false); setSort("popular"); };

  return (
    <div className="space-y-5 pb-28">
      {/* ───── шапка ───── */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(124,58,237,.45),transparent_40%),linear-gradient(125deg,#07111f,#111827_55%,#1e1b4b)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">{dealer ? "Каталог дилера" : "Каталог дистрибьютора"}</p>
          <h1 className="mt-2 text-2xl font-black sm:text-4xl">Всё оборудование HASI в одном месте</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
            {facets.total} позиций · Hikvision, Dahua, TIANDY, Ruijie и другие. Цены — розничные, в сомони.
          </p>
          <label className="relative mt-5 block max-w-2xl">
            <span className="sr-only">Поиск по каталогу</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} placeholder="Модель, бренд или название…"
              className="w-full rounded-2xl border border-white/10 bg-white/95 py-3.5 pl-12 pr-10 text-base text-slate-900 shadow-lg outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-400"
            />
            {q ? <button type="button" onClick={() => setQ("")} aria-label="Очистить" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button> : null}
          </label>
        </div>
      </section>

      {/* ───── фильтры ───── */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">
            <SlidersHorizontal className="h-4 w-4" /> Фильтры {hasFilters ? "•" : ""}
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value as CatalogSort)} aria-label="Сортировка" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className={`${filtersOpen ? "block" : "hidden"} space-y-3 sm:block`}>
          <CategoryFilter
            categories={facets.categories.map((c) => ({ slug: c.slug, name: c.name, count: c.count, image: c.image, icon: c.icon }))}
            active={activeParent?.slug ?? ""}
            onSelect={setCategory}
          />
          {activeParent && activeParent.children.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Подкатегории">
              <button type="button" onClick={() => setCategory(activeParent.slug)} className={chip(category === activeParent.slug)}>Все в разделе</button>
              {activeParent.children.map((c) => (
                <button key={c.slug} type="button" onClick={() => setCategory(c.slug)} className={chip(category === c.slug)}>
                  {c.name} <span className="opacity-60">{c.count}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Бренды">
            <button type="button" onClick={() => setBrand("")} className={chip(!brand)}>Все бренды</button>
            {facets.brands.slice(0, 8).map((b) => (
              <button key={b.name} type="button" onClick={() => setBrand(brand === b.name ? "" : b.name)} className={chip(brand.toUpperCase() === b.name.toUpperCase())}>
                {b.name} <span className="opacity-60">{b.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="h-4 w-4 accent-violet-700" /> Только в наличии
            </label>
            <div className="hidden items-center gap-3 sm:flex">
              <span className="text-sm text-slate-500">Найдено: <b className="text-slate-900 dark:text-white">{total}</b></span>
              <select value={sort} onChange={(e) => setSort(e.target.value as CatalogSort)} aria-label="Сортировка" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {hasFilters ? <button type="button" onClick={reset} className="text-sm font-semibold text-violet-700 hover:underline">Сбросить</button> : null}
            </div>
          </div>
        </div>
      </section>

      {notice ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      {/* ───── сетка ───── */}
      {items.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <PackageSearch className="h-10 w-10 text-slate-400" />
          <p className="font-semibold">Ничего не найдено</p>
          <p className="text-sm text-slate-500">Измените запрос или сбросьте фильтры.</p>
          {hasFilters ? <button type="button" onClick={reset} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white">Сбросить фильтры</button> : null}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
          {items.map((item) => {
            const inCart = cart[item.id] ?? 0;
            return (
              <ProductCard
                key={item.id}
                product={{ ...item, categoryName: item.categoryName }}
                footer={dealer ? (
                  item.stock <= 0 ? <p className="rounded-xl bg-slate-100 py-2 text-center text-xs font-semibold text-slate-500 dark:bg-slate-800">Нет на складе</p>
                  : inCart === 0 ? (
                    <button type="button" onClick={() => setQty(item, 1)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-violet-600 active:scale-95">
                      <Plus className="h-4 w-4" /> В заказ
                    </button>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl bg-violet-50 p-1 dark:bg-violet-500/15">
                      <button type="button" onClick={() => setQty(item, inCart - 1)} aria-label="Меньше" className="grid h-9 w-9 place-items-center rounded-lg bg-white text-violet-700 shadow-sm dark:bg-slate-800"><Minus className="h-4 w-4" /></button>
                      <span className="text-sm font-black text-violet-800 dark:text-violet-200">{inCart}</span>
                      <button type="button" onClick={() => setQty(item, inCart + 1)} disabled={inCart >= item.stock} aria-label="Больше" className="grid h-9 w-9 place-items-center rounded-lg bg-violet-700 text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                    </div>
                  )
                ) : undefined}
              />
            );
          })}
        </div>
      )}

      {items.length < total ? (
        <div className="flex justify-center">
          <button type="button" disabled={loading} onClick={() => void load(items.length, false)}
            className="rounded-2xl border border-violet-200 bg-white px-8 py-3 text-sm font-bold text-violet-700 shadow-sm transition hover:bg-violet-50 disabled:opacity-60 dark:border-violet-500/30 dark:bg-slate-900">
            {loading ? "Загрузка…" : `Показать ещё (${total - items.length})`}
          </button>
        </div>
      ) : null}

      {/* ───── панель заказа (только дилер) ───── */}
      {dealer && count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-2xl ring-1 ring-white/10">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-600"><ShoppingCart className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-300">В заказе: {count} шт.</p>
              <p className="truncate text-lg font-black">{formatTjs(sum)}</p>
            </div>
            <button type="button" onClick={() => setCart({})} className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10">Очистить</button>
            <button type="button" onClick={() => setOrdering(true)} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-400">Оформить →</button>
          </div>
        </div>
      ) : null}

      {ordering ? (
        <DealerOrderModal
          initialCart={cart}
          onClose={() => setOrdering(false)}
          onCreated={(orderNumber) => { setOrdering(false); setCart({}); setNotice(`Заказ ${orderNumber} создан. Он в разделе «Мои заявки».`); }}
        />
      ) : null}
    </div>
  );
}
