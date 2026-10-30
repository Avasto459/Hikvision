"use client";

import { ChevronLeft, ChevronRight, Clock, Truck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { formatTjs } from "@/lib/currency";
import { productImageSrc } from "@/lib/product-images";

/** Баннер для витрины: акционные предложения и скидки. */
export type PromoSlide = { id: string; title: string; subtitle: string; discountPercent: number; image: string; href: string; endsAt: string | null };

export type PromoDeal = { id: string; slug: string; name: string; brand?: string; price: number; previousPrice: number; image?: string };

/** Скидка в процентах; 0, если цена не ниже прежней. */
export function discountPercent(price: number, previous: number) {
  return previous > price && price > 0 ? Math.round((1 - price / previous) * 100) : 0;
}

/** Ближайшее воскресенье 23:59:59 по времени посетителя — конец «акционной недели». */
function nextWeekEnd(from = new Date()) {
  const end = new Date(from);
  end.setDate(from.getDate() + ((7 - from.getDay()) % 7));
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Таймер до `endsAt` (ISO) или, если не задан, до конца недели. null до монтирования — без расхождения SSR/клиент. */
function useCountdown(endsAt?: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const parsed = endsAt ? Date.parse(endsAt) : NaN;
    const end = Number.isFinite(parsed) ? parsed : nextWeekEnd().getTime();
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (left === null) return null;
  const s = Math.floor(left / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Метка LIVE + таймер для одного слайда. */
function SlideTimer({ endsAt }: { endsAt?: string | null }) {
  const left = useCountdown(endsAt);
  if (!left) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-black/30 px-3 py-1 text-[11px] font-bold text-amber-200" aria-label="До конца акции">
      <Clock className="h-3.5 w-3.5" />
      {left.d > 0 ? `${left.d} д ` : ""}{pad(left.h)}:{pad(left.m)}:{pad(left.s)}
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Рекламный блок: слайдер баннеров (акция со скидками, совместная покупка, доставка)
 * и подборка акционных товаров с процентом скидки. Скидки берутся из реальных цен (прежняя цена → текущая).
 */
export function PromoBanner({ deals, promos = [] }: { deals: PromoDeal[]; promos?: PromoSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const maxDiscount = deals.reduce((max, d) => Math.max(max, discountPercent(d.price, d.previousPrice)), 0);

  const defaults = [
    {
      key: "sale", live: true, endsAt: null as string | null, image: "", badge: 0,
      title: maxDiscount ? `Супер скидки до −${maxDiscount}%` : "Выгодные цены на оборудование",
      text: "Камеры, регистраторы, домофоны и сетевое оборудование Hikvision, Dahua, TIANDY по акционным ценам.",
      cta: "Смотреть акции", href: "/catalog?inStock=true", icon: Clock, tone: "from-violet-700/80 via-indigo-800/70 to-slate-900",
    },
    {
      key: "group", live: false, endsAt: null, image: "", badge: 0,
      title: "Совместные закупки",
      text: "Объединяйтесь с коллегами и дилерами — оптовые условия на партии оборудования.",
      cta: "Стать дилером", href: "/register", icon: Users, tone: "from-sky-700/70 via-blue-900/70 to-slate-900",
    },
    {
      key: "delivery", live: false, endsAt: null, image: "", badge: 0,
      title: "Быстрая доставка по Таджикистану",
      text: "Курьер доставит заказ, а статус и маршрут можно отслеживать на карте.",
      cta: "Отследить заказ", href: "/track", icon: Truck, tone: "from-amber-600/60 via-orange-900/60 to-slate-900",
    },
  ];
  const slides = promos.length
    ? promos.map((p) => ({
        key: p.id, live: Boolean(p.endsAt), endsAt: p.endsAt, image: p.image, badge: p.discountPercent,
        title: p.title, text: p.subtitle, cta: "Подробнее", href: p.href, icon: Clock, tone: "from-violet-700/80 via-indigo-800/70 to-slate-900",
      }))
    : defaults;

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length);

  return (
    <section aria-label="Акции и реклама" className="space-y-4">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_40px_-12px_rgba(99,102,241,.6)]"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      >
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((slide, i) => {
            const Icon = slide.icon;
            return (
              <article key={slide.key} aria-hidden={i !== index} className={`relative min-w-full bg-gradient-to-br ${slide.tone} p-6 text-white sm:p-10`}>
                {slide.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={productImageSrc(slide.image)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-transparent" />
                  </>
                ) : null}
                <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
                <Icon className="pointer-events-none absolute bottom-4 right-6 h-28 w-28 text-white/10 sm:h-44 sm:w-44" />
                <div className="relative max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    {slide.live ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-black tracking-widest shadow-[0_0_14px_rgba(244,63,94,.8)]">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />LIVE
                      </span>
                    ) : null}
                    {slide.live ? <SlideTimer endsAt={slide.endsAt} /> : null}
                    {slide.badge ? <span className="rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-3 py-1 text-xs font-black shadow-[0_0_14px_rgba(244,63,94,.7)]">−{slide.badge}%</span> : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">{slide.title}</h2>
                  <p className="mt-2 text-sm text-slate-200 sm:text-base">{slide.text}</p>
                  {slide.href ? (
                    <Link href={slide.href} tabIndex={i === index ? 0 : -1} className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_18px_rgba(251,191,36,.55)] transition hover:brightness-110">
                      {slide.cta} →
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <button type="button" aria-label="Предыдущий баннер" onClick={() => go(-1)} className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60 sm:inline-flex"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" aria-label="Следующий баннер" onClick={() => go(1)} className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60 sm:inline-flex"><ChevronRight className="h-5 w-5" /></button>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((slide, i) => (
            <button key={slide.key} type="button" aria-label={`Баннер ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-amber-300" : "w-2 bg-white/50"}`} />
          ))}
        </div>
      </div>

      {deals.length ? (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {deals.map((deal) => {
            const pct = discountPercent(deal.price, deal.previousPrice);
            return (
              <Link key={deal.id} href={`/product/${deal.slug}`} className="group relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-amber-300/40 bg-white shadow-[0_0_20px_-6px_rgba(251,191,36,.6)] transition hover:-translate-y-0.5 dark:bg-slate-900 sm:w-52">
                <div className="relative">
                  <ProductImage sources={[productImageSrc(deal.image ?? "")]} alt={deal.name} className="aspect-square" />
                  <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-2.5 py-1 text-xs font-black text-white shadow">−{pct}%</span>
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-amber-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />LIVE</span>
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-xs font-bold text-slate-900 dark:text-white">{deal.name}</p>
                  <p className="text-base font-black text-amber-600 dark:text-amber-300">{formatTjs(deal.price)}</p>
                  <p className="text-xs text-slate-400 line-through">{formatTjs(deal.previousPrice)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
