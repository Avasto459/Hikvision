"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";
import { ProductImageFallback } from "@/components/product-image";
import { productImageSrc } from "@/lib/product-images";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const normalized: string[] = [];
  for (const raw of images) {
    // productImageSrc: любой локальный путь превращается в прямую ссылку https://hasi.tj/...
    const value = productImageSrc(raw);
    if (!value || normalized.includes(value)) continue;
    normalized.push(value);
  }
  const sources = normalized;
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const source = sources[active] || "";
  const imageFailed = !source || failed.includes(source);

  function markFailed(value: string) {
    setFailed((current) => current.includes(value) ? current : [...current, value]);
  }

  // Битая ссылка → сразу локальная заглушка (без чужих стоковых фото), следующее фото остаётся доступным.
  function handleImageError(value: string) {
    markFailed(value);
  }

  return (
    <div>
      <button type="button" onClick={() => !imageFailed && setFullscreen(true)} aria-label="Открыть фотографию в большом размере" className="relative flex min-h-80 w-full items-center justify-center overflow-hidden rounded-[30px] border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {imageFailed ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl sm:rounded-[24px]"><ProductImageFallback /></div>
        ) : (
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-100 bg-white sm:rounded-[24px] dark:border-slate-800"><Image src={encodeURI(source)} alt={name} fill sizes="(min-width:1024px) 50vw, 100vw" unoptimized onError={() => handleImageError(source)} className="bg-white object-contain p-2" /></div>
        )}
      </button>
      {sources.length > 1 ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {sources.map((image, index) => (
            <button key={`${image}-${index}`} type="button" onClick={() => setActive(index)} aria-label={`Фотография ${index + 1}`} aria-pressed={active === index} className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-white dark:bg-slate-900 ${active === index ? "border-violet-600" : "border-slate-200 dark:border-slate-700"}`}>
              {failed.includes(image) ? <ProductImageFallback compact /> : <Image src={encodeURI(image)} alt="" fill unoptimized onError={() => handleImageError(image)} className="bg-white object-contain p-1" />}
            </button>
          ))}
        </div>
      ) : null}
      {fullscreen && !imageFailed ? (
        <div role="dialog" aria-modal="true" aria-label="Фотография товара" onClick={() => setFullscreen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <button type="button" aria-label="Закрыть фотографию" onClick={() => setFullscreen(false)} className="absolute right-5 top-5 rounded-full bg-white/15 p-3 text-white"><X className="h-6 w-6" /></button>
          <Image src={encodeURI(source)} alt={name} width={1800} height={1200} unoptimized onError={() => handleImageError(source)} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] max-w-full object-contain" />
        </div>
      ) : null}
    </div>
  );
}
