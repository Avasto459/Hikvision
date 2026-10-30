"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { formatTjs } from "@/lib/currency";
import { productImageSrc } from "@/lib/product-images";

type Product = {
  id: string; name: string; sku: string; brand: string; price: number;
  stock: number | null; image: string; images: string[]; type: "product" | "service"; categoryName?: string;
};

const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

const sourcesOf = (p: Product) => [...new Set([p.image, ...p.images].filter(Boolean).map(productImageSrc).filter(Boolean))];

/**
 * «Создать новый заказ». Телефон: два шага — «Товары» (сетка как в каталоге) и «Корзина» (позиции, итог, покупатель);
 * снизу всегда видна панель «в заказе N · итого», так что корзина не теряется. Компьютер: обе колонки рядом.
 */
export function DealerOrderModal({ onClose, onCreated, initialCart }: { onClose: () => void; onCreated: (orderNumber: string) => void; initialCart?: Record<string, number> }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>(initialCart ?? {});
  const [form, setForm] = useState({ name: "", phone: "", addressComment: "" });
  const [step, setStep] = useState<"products" | "cart">("products");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !submitting) onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, submitting]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/dealer/products/available", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { products?: Product[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Не удалось загрузить товары.");
        if (alive) setProducts(data.products ?? []);
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "Не удалось загрузить товары.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => (!q || `${p.name} ${p.sku} ${p.brand}`.toLowerCase().includes(q)) && (category === "all" || (p.categoryName || "Без категории") === category));
  }, [products, search, category]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.categoryName || "Без категории"))].sort((a, b) => a.localeCompare(b, "ru")), [products]);

  const lines: Array<{ p: Product; quantity: number }> = (Object.entries(cart) as Array<[string, number]>).flatMap(([id, quantity]) => { const p = byId.get(id); return p ? [{ p, quantity }] : []; });
  const total = lines.reduce((sum, l) => sum + l.p.price * l.quantity, 0);
  const itemsCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const maxFor = (p: Product) => (p.stock === null ? 999 : p.stock);

  const setQty = (p: Product, quantity: number) =>
    setCart((c) => (quantity <= 0 ? Object.fromEntries(Object.entries(c).filter(([id]) => id !== p.id)) : { ...c, [p.id]: Math.min(quantity, maxFor(p)) }));
  const add = (p: Product) => setQty(p, (cart[p.id] ?? 0) + 1);

  async function submit() {
    setError("");
    if (!lines.length) return setError("Добавьте в заказ хотя бы один товар.");
    if (form.name.trim().length < 2) return setError("Укажите имя покупателя.");
    if (!/^\+?[0-9 ()-]{7,20}$/.test(form.phone.trim())) return setError("Укажите телефон покупателя, например +992XXXXXXXXX.");
    if (form.addressComment.trim().length < 3) return setError("Укажите адрес или комментарий (минимум 3 символа).");
    setSubmitting(true);
    try {
      const res = await fetch("/api/dealer/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: lines.map((l) => ({ productId: l.p.id, quantity: l.quantity })) }),
      });
      const data = (await res.json().catch(() => ({}))) as { orderNumber?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось создать заказ.");
      onCreated(data.orderNumber ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать заказ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Создать новый заказ" className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-stretch justify-center overflow-hidden bg-black/75" onClick={() => !submitting && onClose()}>
      <div className="flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-4">
          <div className="min-w-0"><h2 className="text-lg font-black text-slate-900 dark:text-white sm:text-xl">Создать новый заказ</h2><p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Каталог и оформление заказа · HASI.TJ</p></div>
          <button onClick={onClose} disabled={submitting} aria-label="Закрыть" className="rounded-lg px-3 py-1 text-2xl leading-none text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">×</button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.8fr)]">
          {/* ───── сетка товаров ───── */}
          <section className={`${step === "cart" ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-col overflow-y-auto p-3 sm:p-4 lg:border-r lg:border-slate-200 lg:p-6 dark:lg:border-slate-800`}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Выберите товары</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию, артикулу или бренду…" aria-label="Поиск товаров" className={inputClass} /><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Фильтр по категории" className={inputClass}><option value="all">Все категории</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
            {loading ? <p className="mt-6 text-sm text-slate-500">Загружаем товары…</p> : null}
            {loadError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{loadError}</p> : null}
            {!loading && !loadError && shown.length === 0 ? <p className="mt-6 text-sm text-slate-500">{products.length ? "Ничего не найдено." : "Нет товаров в наличии на складе."}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 sm:gap-4">
              {shown.map((p) => {
                const inCart = cart[p.id] ?? 0;
                return (
                  <article key={p.id} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white dark:bg-slate-950 ${inCart ? "border-violet-500" : "border-slate-200 dark:border-slate-800"}`}>
                    <ProductImage sources={sourcesOf(p)} alt={p.name} className="aspect-square" fit="contain" hoverZoom={false} />
                    <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
                      <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-slate-900 dark:text-white sm:text-sm">{p.name}</p>
                      <p className="text-sm font-black text-violet-700 dark:text-violet-300">{formatTjs(p.price)}</p>
                      <p className="text-xs text-slate-500">{p.stock === null ? "Услуга" : `Осталось: ${p.stock}`}</p>
                      {inCart === 0 ? (
                        <button type="button" onClick={() => add(p)} className="mt-auto rounded-xl bg-violet-700 px-2 py-2 text-xs font-bold text-white transition hover:bg-violet-600 active:scale-95">+ Добавить</button>
                      ) : (
                        <div className="mt-auto flex items-center justify-between rounded-xl bg-violet-50 p-1 dark:bg-violet-500/15">
                          <button type="button" onClick={() => setQty(p, inCart - 1)} aria-label="Меньше" className="h-8 w-8 rounded-lg bg-white text-base font-bold text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300">−</button>
                          <span className="text-sm font-black text-violet-800 dark:text-violet-200">{inCart}</span>
                          <button type="button" onClick={() => setQty(p, inCart + 1)} disabled={inCart >= maxFor(p)} aria-label="Больше" className="h-8 w-8 rounded-lg bg-violet-700 text-base font-bold text-white disabled:opacity-40">+</button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ───── корзина заказа и данные покупателя ───── */}
          <section className={`${step === "products" ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-col gap-4 overflow-y-auto bg-slate-50/70 p-3 sm:p-4 lg:p-6 dark:bg-slate-900`}>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">В корзине заказа</h3>
              {lines.length === 0 ? <p className="mt-3 text-sm text-slate-500">Пока пусто — добавьте товары на шаге «Товары».</p> : (
                <ul className="mt-3 space-y-2">
                  {lines.map(({ p, quantity }) => (
                    <li key={p.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg"><ProductImage sources={sourcesOf(p)} alt={p.name} className="aspect-square" fit="contain" hoverZoom={false} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-slate-500">{formatTjs(p.price)} × {quantity} = <span className="font-bold text-slate-700 dark:text-slate-200">{formatTjs(p.price * quantity)}</span></p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => setQty(p, quantity - 1)} aria-label="Меньше" className="h-8 w-8 rounded-lg border border-slate-300 text-sm dark:border-slate-600 dark:text-white">−</button>
                        <span className="w-6 text-center text-sm font-semibold text-slate-900 dark:text-white">{quantity}</span>
                        <button type="button" onClick={() => setQty(p, quantity + 1)} disabled={quantity >= maxFor(p)} aria-label="Больше" className="h-8 w-8 rounded-lg border border-slate-300 text-sm disabled:opacity-40 dark:border-slate-600 dark:text-white">+</button>
                        <button type="button" onClick={() => setQty(p, 0)} aria-label={`Убрать ${p.name}`} className="ml-1 h-8 w-8 rounded-lg text-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">×</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Итого</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{formatTjs(total)}</span>
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Покупатель</h3>
              <input className={inputClass} placeholder="Имя" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={inputClass} type="tel" inputMode="tel" placeholder="Телефон +992XXXXXXXXX" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <textarea className={inputClass} rows={3} placeholder="Адрес / комментарий" value={form.addressComment} onChange={(e) => setForm({ ...form, addressComment: e.target.value })} />
            </div>

            {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}
            <div className="hidden gap-3 lg:mt-auto lg:flex">
              <button type="button" onClick={() => void submit()} disabled={submitting || lines.length === 0}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">
                {submitting ? "Создаём…" : "Создать заказ"}
              </button>
              <button type="button" onClick={onClose} disabled={submitting} className="hidden rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200 sm:block">Отмена</button>
            </div>
          </section>
        </div>

        {/* нижняя панель на телефоне: итог и главное действие всегда на виду (над нижним меню сайта) */}
        <div className="flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          {step === "cart" ? (
            <button type="button" onClick={() => setStep("products")} disabled={submitting} className="shrink-0 rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">← Товары</button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">В заказе: {itemsCount} шт.</p>
            <p className="truncate text-base font-black text-slate-900 dark:text-white">{formatTjs(total)}</p>
          </div>
          {step === "products" ? (
            <button type="button" onClick={() => setStep("cart")} disabled={lines.length === 0} className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Оформить →</button>
          ) : (
            <button type="button" onClick={() => void submit()} disabled={submitting || lines.length === 0} className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{submitting ? "Создаём…" : "Создать заказ"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
