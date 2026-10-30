"use client";

import Image from "next/image";
import { useState } from "react";

/** encodeURI без двойного кодирования уже закодированных адресов (%D0…). */
function safeUrl(value: string) {
  try { return encodeURI(decodeURI(value)); } catch { return value; }
}

/**
 * Запасная картинка без обращения к сети: стилизованная камера наблюдения (inline SVG).
 * Показывается, когда у товара нет фото или фото не загрузилось. `compact` — без подписи (миниатюры).
 */
export function ProductImageFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div role="img" aria-label="Фото товара скоро появится" className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 dark:from-slate-800 dark:to-slate-900 dark:text-slate-500">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={compact ? "h-1/2 w-1/2" : "h-2/5 w-2/5 max-h-28 max-w-28"} aria-hidden="true">
        <rect x="6" y="18" width="38" height="20" rx="5" />
        <circle cx="25" cy="28" r="6" />
        <circle cx="25" cy="28" r="2" fill="currentColor" />
        <path d="M44 24l14-6v22l-14-6" />
        <path d="M18 38v8m0 0h14m-14 0l-6 6m20-6l6 6" opacity=".6" />
      </svg>
      {compact ? null : <span className="px-2 text-center text-[11px] font-semibold sm:text-xs">Фото скоро появится</span>}
    </div>
  );
}

type Props = {
  /** Уже нормализованные адреса (см. productImageSrc); первый рабочий будет показан. */
  sources: string[];
  alt: string;
  /** Классы контейнера: по умолчанию квадратная область 4:3. */
  className?: string;
  /** `contain` — товар целиком без обрезки (по умолчанию), `cover` — заполнение с обрезкой. */
  fit?: "contain" | "cover";
  hoverZoom?: boolean;
};

/**
 * Изображение товара с фиксированным aspect-ratio: картинка никогда не растягивается
 * и не искажается (object-fit), а при отсутствии/ошибке загрузки показывается заглушка.
 */
export function ProductImage({ sources, alt, className = "aspect-square", fit = "contain", hoverZoom = true }: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const [retried, setRetried] = useState<string[]>([]);
  const source = sources.find((value) => value && !failed.includes(value)) || "";
  const retrying = source !== "" && retried.includes(source);
  const src = source ? safeUrl(source) + (retrying ? (source.includes("?") ? "&" : "?") + "r=1" : "") : "";
  return (
    <div className={`relative w-full overflow-hidden ${fit === "contain" ? "bg-white" : "bg-neutral-100 dark:bg-neutral-800/50"} ${className}`}>
      {source ? (
        <Image
          key={src}
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          unoptimized
          onError={() => {
            // Первая ошибка — одна повторная попытка (сервер мог быть занят компиляцией), вторая — к следующему адресу или заглушке.
            if (!retried.includes(source)) setRetried((current) => [...current, source]);
            else setFailed((current) => (current.includes(source) ? current : [...current, source]));
          }}
          className={fit === "cover" ? "object-cover" : "object-contain p-2"}
        />
      ) : (
        <ProductImageFallback />
      )}
    </div>
  );
}

/**
 * Маленькое превью (корзина, поиск): фиксированный квадрат, object-fit без искажений,
 * при пустой или битой ссылке — компактный красивый placeholder-фото камеры.
 */
export function ProductThumb({ src, alt = "", size = 96, rounded = "rounded-xl" }: { src?: string | null; alt?: string; size?: number; rounded?: string }) {
  const [attempt, setAttempt] = useState(0);
  const px = `${size}px`;
  const url = src ? safeUrl(src) + (attempt === 1 ? (src.includes("?") ? "&" : "?") + "r=1" : "") : "";
  return (
    <div style={{ width: px, height: px }} className={`relative shrink-0 overflow-hidden border border-slate-100 bg-neutral-100 dark:border-slate-800 dark:bg-neutral-800/50 ${rounded}`}>
      {src && attempt < 2 ? (
        <Image key={url} src={url} alt={alt} fill sizes={px} unoptimized onError={() => setAttempt((n) => n + 1)} className="object-cover" />
      ) : (
        <ProductImageFallback compact />
      )}
    </div>
  );
}
