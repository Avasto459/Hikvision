"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { useCart, type CartProduct } from "@/components/store-provider";
import type { Product } from "@/lib/db";

export function FavoriteButton({ product }: { product: Product & { categorySlug?: string; categoryName?: string } }) {
  const { isFavorite, toggleFavorite } = useCart();
  const [error, setError] = useState("");
  const active = isFavorite(product.id);

  async function toggle() {
    setError("");
    try {
      await toggleFavorite({ ...product, quantity: 1 } as CartProduct);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить избранное.");
    }
  }

  return (
    <span className="inline-flex flex-col items-center">
      <button type="button" onClick={() => void toggle()} aria-label={active ? "Убрать из избранного" : "Добавить в избранное"} aria-pressed={active} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <Heart className={`h-5 w-5 ${active ? "fill-rose-600 text-rose-600" : ""}`} />
      </button>
      {error ? <span role="alert" className="mt-1 text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}
