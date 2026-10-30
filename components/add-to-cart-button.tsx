"use client";

import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart, type CartProduct } from "@/components/store-provider";
import type { Product } from "@/lib/db";

/** Кнопка «В корзину» для карточки товара. Блокируется, если товара нет в наличии. */
export function AddToCartButton({ product, disabled = false }: { product: Product; disabled?: boolean }) {
  const { addItem } = useCart();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function add() {
    if (state === "busy" || disabled) return;
    setError("");
    setState("busy");
    try {
      await addItem({ ...product, quantity: 1 } as CartProduct, 1);
      setState("done");
      window.setTimeout(() => setState("idle"), 1800);
    } catch (reason) {
      setState("idle");
      setError(reason instanceof Error ? reason.message : "Не удалось добавить в корзину.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void add()}
        disabled={disabled || state === "busy"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-600 px-3 py-2 text-sm font-bold text-white shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "done" ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
        {disabled ? "Нет в наличии" : state === "done" ? "Добавлено" : "В корзину"}
      </button>
      {error ? <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
