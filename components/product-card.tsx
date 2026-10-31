
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { FavoriteButton } from "@/components/favorite-button";
import { ProductImage } from "@/components/product-image";
import { formatTjs } from "@/lib/currency";
import type { Product } from "@/lib/db";
import { normalizeBrandKey } from "@/lib/pricing";
import {
  productImageSrc,
  FALLBACK_PRODUCT_IMAGE,
} from "@/lib/product-images";

/** Минимальный набор полей карточки товара. */
export type ProductCardData = {
  id: string;
  name: string;
  slug?: string;
  brand?: string | null;
  categoryName?: string | null;
  price: number;
  previousPrice?: number | null;
  stock?: number;
  image?: string | null;
  images?: string[] | null;
  type?: "product" | "service";
  isPublished?: number;
  distributor_id?: string | null;
  distributor_name?: string | null;
};

type Props = {
  product: ProductCardData;
  showSupplier?: boolean;
  compact?: boolean;
  favorite?: boolean;
  cart?: boolean;
  footer?: ReactNode;
};

const BRAND_STYLE: Record<string, string> = {
  TIANDY: "bg-sky-600 text-white",
  HIKVISION: "bg-rose-600 text-white",
  DAHUA: "bg-amber-500 text-white",
  RUIJIE: "bg-emerald-600 text-white",
};

export function ProductCard({
  product,
  showSupplier = false,
  compact = false,
  favorite = false,
  cart = false,
  footer,
}: Props) {
  const brand = (product.brand ?? "").trim();

  const price = Number.isFinite(product.price)
    ? product.price
    : 0;

  const old =
    product.previousPrice && product.previousPrice > price
      ? product.previousPrice
      : null;

  const discount = old
    ? Math.round((1 - price / old) * 100)
    : 0;

  const service = product.type === "service";

  const stock =
    typeof product.stock === "number"
      ? product.stock
      : null;

  const out =
    !service && stock !== null && stock <= 0;

  // Источники изображений товара.
  const rawSources = [
    product.image,
    ...(product.images ?? []),
  ]
    .filter(Boolean)
    .map((source) => String(source).trim())
    .filter(
      (source) =>
        !/^\/?products\/(camera-[^/]+|placeholder)[^/]*\.svg(?:\?.*)?$/i.test(
          source
        )
    );

  const sources = [
    ...new Set(
      [
        ...rawSources.map((source) =>
          productImageSrc(source)
        ),
        FALLBACK_PRODUCT_IMAGE,
      ].filter(Boolean)
    ),
  ];

  const supplier = product.distributor_id
    ? (product.distributor_name ?? "").trim() || "без имени"
    : "Администратор";

  const href = product.slug
    ? `/product/${product.slug}`
    : null;

  // Изображение товара.
  const image = (
    <div className="relative w-full overflow-hidden bg-white dark:bg-slate-950">
      <ProductImage
        sources={sources}
        alt={product.name || "Товар"}
        className={
          compact
            ? "aspect-square w-full"
            : "aspect-[4/3] w-full"
        }
        fit="contain"
      />

      {brand ? (
        <span
          className={`absolute left-2 top-2 z-10 rounded-full px-2.5 py-1 text-[10px] font-bold shadow ${BRAND_STYLE[normalizeBrandKey(brand)] ?? "bg-slate-800 text-white"}`}
        >
          {brand}
        </span>
      ) : null}

      {discount >= 3 ? (
        <span className="absolute bottom-2 left-2 z-10 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-2.5 py-1 text-[10px] font-black text-white shadow">
          АКЦИЯ −{discount}%
        </span>
      ) : null}

      {out ? (
        <span className="absolute bottom-2 right-2 z-10 rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] font-semibold text-white">
          Нет в наличии
        </span>
      ) : null}

      {product.isPublished === 0 ? (
        <span className="absolute bottom-2 right-2 z-10 rounded-full bg-slate-500 px-2.5 py-1 text-[10px] font-semibold text-white">
          Скрыт
        </span>
      ) : null}
    </div>
  );

  // Название товара.
  const title = (
    <h3
      className={`line-clamp-2 break-words font-bold leading-snug text-slate-900 dark:text-white ${
        compact ? "text-[13px]" : "text-sm"
      }`}
    >
      {product.name || "Без названия"}
    </h3>
  );

  return (
    <article
      className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 dark:bg-slate-900 ${
        discount >= 3
          ? "border-amber-300/70 shadow-[0_0_22px_-6px_rgba(251,191,36,.35)] hover:shadow-lg"
          : "border-slate-200 hover:border-violet-300 hover:shadow-lg dark:border-slate-800"
      }`}
    >
      {/* Фото товара */}
      {href ? (
        <Link
          href={href}
          aria-label={product.name}
          className="block w-full"
        >
          {image}
        </Link>
      ) : (
        image
      )}

      {/* Кнопка избранного */}
      {favorite ? (
        <div className="absolute right-2 top-2 z-20 scale-90">
          <FavoriteButton
            product={product as unknown as Product}
          />
        </div>
      ) : null}

      {/* Информация о товаре */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        {product.categoryName ? (
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
            {product.categoryName}
          </p>
        ) : null}

        {href ? (
          <Link
            href={href}
            className="min-w-0 hover:text-violet-700 dark:hover:text-violet-300"
          >
            {title}
          </Link>
        ) : (
          title
        )}

        {/* Цена */}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="text-lg font-black text-slate-900 dark:text-white">
            {formatTjs(price)}
          </span>

          {old ? (
            <span className="text-xs text-slate-400 line-through">
              {formatTjs(old)}
            </span>
          ) : null}
        </div>

        {/* Остаток */}
        {!service && stock !== null && !out ? (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            В наличии: {stock} шт.
          </p>
        ) : null}

        {/* Добавить в корзину */}
        {cart && !service ? (
          <div className="pt-2">
            <AddToCartButton
              product={product as unknown as Product}
              disabled={out}
            />
          </div>
        ) : null}

        {/* Дополнительные кнопки */}
        {footer ? (
          <div className="pt-2">
            {footer}
          </div>
        ) : null}

        {/* Кто добавил товар */}
        {showSupplier ? (
          <p className="text-xs text-slate-500">
            Добавил:{" "}
            <b className="text-emerald-700 dark:text-emerald-300">
              {supplier}
            </b>
          </p>
        ) : null}
      </div>
    </article>
  );
}
