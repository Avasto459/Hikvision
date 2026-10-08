"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/db";

export type CartProduct = Product & { categorySlug?: string; categoryName?: string; quantity: number };

type CartContextValue = {
  items: CartProduct[];
  favorites: CartProduct[];
  favoriteCount: number;
  count: number;
  total: number;
  notice: string;
  ready: boolean;
  addItem: (product: CartProduct, quantity?: number) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  toggleFavorite: (product: CartProduct) => Promise<void>;
  isFavorite: (productId: string) => boolean;
  clearCart: () => void;
  clearNotice: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "hasi-cart";
const FAVORITES_KEY = "hasi-favorites";

function token() {
  return typeof window === "undefined" ? null : localStorage.getItem("hasi-token");
}

function readSavedCart(): Array<{ productId: string; quantity: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line): line is { productId: string; quantity: number } =>
      typeof line?.productId === "string" && Number.isInteger(line?.quantity) && line.quantity > 0,
    );
  } catch {
    return [];
  }
}

function readSavedFavorites(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartProduct[]>([]);
  const [favorites, setFavorites] = useState<CartProduct[]>([]);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);

  const hydrate = useCallback(async () => {
    const saved = readSavedCart();
    const savedFavorites = readSavedFavorites();
    const authToken = token();
    if (authToken) {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [cartResponse, favoriteResponse] = await Promise.all([
        fetch("/api/cart", { headers }),
        fetch("/api/favorites", { headers }),
      ]);
      if (cartResponse.ok && favoriteResponse.ok) {
        const cartData = await cartResponse.json() as { items: CartProduct[] };
        const favoriteData = await favoriteResponse.json() as { products: CartProduct[] };
        setItems(cartData.items);
        setFavorites(favoriteData.products);
        for (const line of saved) {
          const currentQuantity = cartData.items.find((item) => item.id === line.productId)?.quantity || 0;
          const merged = await fetch("/api/cart", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ productId: line.productId, quantity: currentQuantity + line.quantity }),
          });
          if (!merged.ok) {
            const result = await merged.json() as { error?: string };
            throw new Error(result.error || "Не удалось перенести корзину в аккаунт.");
          }
        }
        localStorage.removeItem(STORAGE_KEY);
        for (const productId of savedFavorites) {
          if (!favoriteData.products.some((item) => item.id === productId)) {
            const merged = await fetch("/api/favorites", {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
              body: JSON.stringify({ productId }),
            });
            if (!merged.ok) {
              const result = await merged.json() as { error?: string };
              throw new Error(result.error || "Не удалось перенести избранное в аккаунт.");
            }
          }
        }
        localStorage.removeItem(FAVORITES_KEY);
        const refreshed = await fetch("/api/cart", { headers: { Authorization: `Bearer ${authToken}` } });
        if (!refreshed.ok) {
          const result = await refreshed.json() as { error?: string };
          throw new Error(result.error || "Не удалось обновить корзину аккаунта.");
        }
        setItems((await refreshed.json() as { items: CartProduct[] }).items);
        const refreshedFavorites = await fetch("/api/favorites", { headers });
        if (!refreshedFavorites.ok) {
          const result = await refreshedFavorites.json() as { error?: string };
          throw new Error(result.error || "Не удалось обновить избранное.");
        }
        setFavorites((await refreshedFavorites.json() as { products: CartProduct[] }).products);
        setReady(true);
        return;
      }
      if (cartResponse.status !== 401 || favoriteResponse.status !== 401) {
        const failedResponse = cartResponse.ok ? favoriteResponse : cartResponse;
        const result = await failedResponse.json() as { error?: string };
        throw new Error(result.error || "Не удалось загрузить данные аккаунта.");
      }
    }

    if (!saved.length && !savedFavorites.length) {
      setItems([]);
      setFavorites([]);
      setReady(true);
      return;
    }
    const productIds = [...new Set([...saved.map((line) => line.productId), ...savedFavorites])];
    const response = await fetch(`/api/products?ids=${encodeURIComponent(productIds.join(","))}&limit=100`);
    if (!response.ok) throw new Error("Не удалось загрузить корзину.");
    const data = await response.json() as { products: CartProduct[] };
    const lines = data.products.map((product) => ({
      ...product,
      quantity: Math.min(product.stock, saved.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0)),
    })).filter((product) => product.quantity > 0);
    setItems(lines);
    setFavorites(data.products.filter((product) => savedFavorites.includes(product.id)));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.map(({ id, quantity }) => ({ productId: id, quantity }))));
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(data.products.filter((product) => savedFavorites.includes(product.id)).map((product) => product.id)));
    setReady(true);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(hydrate)
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Не удалось загрузить корзину."))
      .finally(() => setReady(true));
    const authChanged = () => {
      void hydrate().catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Не удалось обновить корзину."));
    };
    window.addEventListener("hasi-auth-changed", authChanged);
    return () => window.removeEventListener("hasi-auth-changed", authChanged);
  }, [hydrate]);

  const addItem = useCallback(async (product: CartProduct, amount = 1) => {
    if (!Number.isInteger(amount) || amount < 1) throw new Error("Укажите корректное количество.");
    const existing = items.find((item) => item.id === product.id);
    const quantity = (existing?.quantity || 0) + amount;
    if (quantity > product.stock) throw new Error(`В наличии только ${product.stock} шт.`);

    if (token()) {
      const response = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось добавить товар.");
      setItems(data.items);
    } else {
      const nextItems = existing
        ? items.map((item) => item.id === product.id ? { ...item, quantity } : item)
        : [...items, { ...product, quantity }];
      setItems(nextItems);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems.map(({ id, quantity: count }) => ({ productId: id, quantity: count }))));
    }
    setNotice("Товар добавлен в корзину.");
  }, [items]);

  const setQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Укажите корректное количество.");
    const product = items.find((item) => item.id === productId);
    if (!product) return;
    if (quantity > product.stock) throw new Error(`В наличии только ${product.stock} шт.`);
    if (token()) {
      const response = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ productId, quantity }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось обновить корзину.");
      setItems(data.items);
    } else {
      const nextItems = quantity === 0
        ? items.filter((item) => item.id !== productId)
        : items.map((item) => item.id === productId ? { ...item, quantity } : item);
      setItems(nextItems);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems.map(({ id, quantity: count }) => ({ productId: id, quantity: count }))));
    }
  }, [items]);

  const removeItem = useCallback(async (productId: string) => {
    if (token()) {
      const response = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ productId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось удалить товар.");
      setItems(data.items);
    } else {
      const nextItems = items.filter((item) => item.id !== productId);
      setItems(nextItems);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems.map(({ id, quantity }) => ({ productId: id, quantity }))));
    }
  }, [items]);

  const toggleFavorite = useCallback(async (product: CartProduct) => {
    const exists = favorites.some((item) => item.id === product.id);
    if (token()) {
      const response = await fetch("/api/favorites", {
        method: exists ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await response.json() as { products?: CartProduct[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось обновить избранное.");
      setFavorites(data.products || []);
    } else {
      const next = exists ? favorites.filter((item) => item.id !== product.id) : [...favorites, product];
      setFavorites(next);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next.map((item) => item.id)));
    }
  }, [favorites]);

  const value = useMemo(() => ({
    items,
    favorites,
    favoriteCount: favorites.length,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    notice,
    addItem,
    setQuantity,
    removeItem,
    toggleFavorite,
    isFavorite: (productId: string) => favorites.some((item) => item.id === productId),
    clearCart: () => {
      setItems([]);
      localStorage.removeItem(STORAGE_KEY);
    },
    clearNotice: () => setNotice(""),
    ready,
  }), [items, favorites, notice, addItem, setQuantity, removeItem, toggleFavorite, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within StoreProvider.");
  return value;
}
