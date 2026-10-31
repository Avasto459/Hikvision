"use client";

import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart, type CartProduct } from "@/components/store-provider";
import type { Product } from "@/lib/db";

/** Кнопка «В корзину» для карточки товара.
 *  - Изначально: фиолетовый градиент, текст «В корзина»
 *  - После добавления: зеленый фон #16A34A, текст «Добавлено» с галочкой ✓
 *  - Если товар уже в корзине: «Добавлено ✓», зеленый фон сохраняется
 *  - При ошибке: возвращается к исходному состоянию
 *  - Универсальное использование на всех страницах
 */
export function AddToCartButton({ product, disabled = false }: { product: Product; disabled?: boolean }) {
  const { addItem, items } = useCart();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const isInCart = items.some((item) => item.id === product.id);

  async function add() {
    if (state === "busy" || disabled || isInCart) return;
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

  // Determine button classes based on state
  const isDone = state === "done";
  const buttonClass = isDone
    ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16A34A] text-white shadow-sm"
    : "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:brightness-110";

  return (
    <div>
      {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={() => void add()}
        disabled={disabled || state === "busy" || isInCart}
        className={buttonClass}
      >
        {state === "done" ? (
          <span className="flex items-center gap-1">
            <Check className="h-4 w-4" />
            <span>Добавлено</span>
          </span>
        ) : isInCart ? (
          <span className="flex items-center gap-1">
            <Check className="h-4 w-4" />
            <span>Добавлено ✓</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <ShoppingCart className="h-4 w-4" />
            <span>В корзина</span>
          </span>
        )}
      </button>
      {isInCart && state !== "done" && !error && (
        <p className="mt-1 text-xs text-emerald-600">В корзине</p>
      )}
      {error && !isInCart && (
        <p className="mt-1 text-xs text-rose-600">⚠ {error}</p>
      )}
    </div>
  );
}
