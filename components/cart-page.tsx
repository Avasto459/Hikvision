"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/store-provider";
import { formatTjs } from "@/lib/currency";
import { ProductThumb } from "@/components/product-image";
import { productImageSrc } from "@/lib/product-images";

export function CartPage() {
  const { items, total, ready, setQuantity, removeItem } = useCart();
  const [error, setError] = useState("");

  async function update(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить корзину.");
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-black text-slate-900 dark:text-white">Корзина</h1>
      {!ready ? <p className="mt-6 text-slate-500">Загружаем корзину…</p> : null}
      {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
      {ready && !items.length ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300">В корзине пока нет товаров.</p>
          <Link href="/catalog" className="mt-5 inline-flex rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white">Перейти в каталог</Link>
        </div>
      ) : null}
      {items.length ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <ProductThumb src={item.image ? productImageSrc(item.image) : ""} alt={item.name} size={96} />
                <div className="min-w-40 flex-1">
                  <Link href={`/product/${item.slug}`} className="font-bold text-slate-900 hover:text-violet-600 dark:text-white">{item.name}</Link>
                  <p className="mt-1 text-sm text-slate-500">{formatTjs(item.price)} / шт.</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Сумма: {formatTjs(item.price * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Уменьшить количество" onClick={() => void update(() => setQuantity(item.id, item.quantity - 1))} className="rounded-full border border-slate-200 p-2 dark:border-slate-700"><Minus className="h-4 w-4" /></button>
                  <span className="w-8 text-center font-semibold">{item.quantity}</span>
                  <button type="button" aria-label="Увеличить количество" disabled={item.quantity >= item.stock} onClick={() => void update(() => setQuantity(item.id, item.quantity + 1))} className="rounded-full border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"><Plus className="h-4 w-4" /></button>
                  <button type="button" aria-label="Удалить товар" onClick={() => void update(() => removeItem(item.id))} className="rounded-full p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            ))}
          </div>
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold">Ваш заказ</h2>
            <div className="mt-4 flex justify-between gap-3 text-sm"><span>Товаров</span><span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
            <div className="mt-4 flex justify-between gap-3 border-t border-slate-200 pt-4 font-bold dark:border-slate-700"><span>Итого</span><span>{formatTjs(total)}</span></div>
            <Link href="/checkout" className="mt-6 inline-flex w-full justify-center rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-600">Оформить заказ</Link>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
