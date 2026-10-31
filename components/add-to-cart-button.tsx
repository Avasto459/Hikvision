
"use client";

import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart, type CartProduct } from "@/components/store-provider";
import type { Product } from "@/lib/db";

export function AddToCartButton({
  product,
  disabled = false,
}: {
  product: Product;
  disabled?: boolean;
}) {
  const { addItem, items } = useCart();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  const isInCart = items.some((item) => item.id === product.id);
  const isAdded = isInCart || state === "done";

  async function handleAddToCart() {
    if (state === "busy" || disabled || isInCart) return;

    setError("");
    setState("busy");

    try {
      await addItem({ ...product, quantity: 1 } as CartProduct, 1);
      setState("done");
    } catch (reason) {
      setState("idle");
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось добавить товар в корзину."
      );
    }
  }

  return (
    <div className="w-full min-w-0">
      <button
        type="button"
        onClick={() => void handleAddToCart()}
        disabled={disabled || state === "busy" || isInCart}
        aria-label={isAdded ? "Товар добавлен в корзину" : "Добавить в корзину"}
        className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${
          isAdded
            ? "bg-emerald-600 text-white"
            : "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:brightness-110 active:scale-[0.98]"
        } disabled:cursor-not-allowed disabled:opacity-90`}
      >
        {isAdded ? (
          <>
            <Check className="h-5 w-5 shrink-0" />
            <span>Добавлено</span>
          </>
        ) : state === "busy" ? (
          <span>Добавление...</span>
        ) : (
          <>
            <ShoppingCart className="h-5 w-5 shrink-0" />
            <span>В корзину</span>
          </>
        )}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-500">
          {error}
        </p>
      )}
    </div>
  );
}
