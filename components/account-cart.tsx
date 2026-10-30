"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProductThumb } from "@/components/product-image";
import { useCart } from "@/components/store-provider";
import { formatTjs } from "@/lib/currency";
import { productImageSrc } from "@/lib/product-images";

/** Корзина внутри личного кабинета: состав, количество, удаление, переход к оформлению. */
export function AccountCart() {
  const { items, total, count, ready, setQuantity, removeItem } = useCart();
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить корзину.");
    }
  }

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-2xl font-black">Моя корзина{count ? ` (${count})` : ""}</h2>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {!ready ? <p className="mt-4 text-sm text-slate-500">Загружаем корзину…</p> : null}
      {ready && !items.length ? (
        <div className="mt-4 text-sm text-slate-500">
          <p>В корзине пока пусто.</p>
          <Link href="/catalog" className="mt-3 inline-flex rounded-xl bg-violet-700 px-4 py-2 font-bold text-white">Перейти в каталог</Link>
        </div>
      ) : null}
      {items.length ? (
        <>
          <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                <ProductThumb src={productImageSrc(item.image)} alt={item.name} size={72} />
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${item.slug}`} className="line-clamp-2 break-words text-sm font-bold hover:text-violet-700">{item.name}</Link>
                  <p className="mt-0.5 text-xs text-slate-500">{formatTjs(item.price)} за шт.</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" aria-label="Меньше" disabled={item.quantity <= 1} onClick={() => void run(() => setQuantity(item.id, item.quantity - 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-slate-700"><Minus className="h-4 w-4" /></button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button type="button" aria-label="Больше" onClick={() => void run(() => setQuantity(item.id, item.quantity + 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700"><Plus className="h-4 w-4" /></button>
                    <button type="button" aria-label="Убрать из корзины" onClick={() => void run(() => removeItem(item.id))} className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-black">{formatTjs(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <p className="text-lg font-black">Итого: {formatTjs(total)}</p>
            <Link href="/checkout" className="rounded-xl bg-gradient-to-r from-violet-700 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-700/20">Оформить заказ</Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
