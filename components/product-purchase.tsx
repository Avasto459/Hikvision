"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/db";
import { useCart } from "@/components/store-provider";

export function ProductPurchase({ product }: { product: Product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  async function add(redirectToCheckout = false) {
    setError("");
    try {
      await addItem({ ...product, quantity }, quantity);
      setAdded(true);
      if (redirectToCheckout) router.push("/checkout");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось добавить товар.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700">
          <button type="button" aria-label="Уменьшить количество" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="p-3 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
          <span className="min-w-10 text-center font-semibold">{quantity}</span>
          <button type="button" aria-label="Увеличить количество" disabled={quantity >= product.stock} onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))} className="p-3 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
        </div>
        <button type="button" disabled={product.stock === 0} onClick={() => void add()} className="inline-flex items-center gap-2 rounded-full bg-violet-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-slate-400">
          <ShoppingCart className="h-4 w-4" /> {added ? "Добавлено в корзину" : "Добавить в корзину"}
        </button>
        <button type="button" disabled={product.stock === 0} onClick={() => void add(true)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-50">
          Купить сейчас <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {product.stock === 0 ? <p className="text-sm text-rose-600">Товара нет в наличии.</p> : null}
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      {added && !error ? <p role="status" className="text-sm text-emerald-600"><Link href="/cart" className="underline">Перейти в корзину</Link></p> : null}
    </div>
  );
}
