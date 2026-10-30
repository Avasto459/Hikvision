"use client";

import {
  Bell, Cable, Camera, ChevronLeft, ChevronRight, Fingerprint, HardDrive, LayoutGrid, Lock, Monitor, Network,
  Package, Phone, Server, Wifi, Wrench, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { productImageSrc } from "@/lib/product-images";


export type FilterCategory = { slug: string; name: string; count?: number; image?: string; icon?: string };

type Props = {
  categories: FilterCategory[];
  /** slug активной категории (пусто — «Все») */
  active?: string;
  /** Базовый адрес каталога и параметры, которые нужно сохранить при смене категории (бренд, поиск…). */
  basePath?: string;
  keepQuery?: Record<string, string | undefined>;
  /** Если задан — плитки работают как кнопки (фильтрация на месте, без перехода по ссылке). */
  onSelect?: (slug: string) => void;
};

/** Подбор иконки и цвета плашки по названию/slug категории. */
const RULES: { test: RegExp; icon: LucideIcon; tone: string }[] = [
  { test: /nvr|dvr|регистратор|видеорегистр/i, icon: Server, tone: "from-indigo-500/30 to-sky-500/10" },
  { test: /(ip|ptz|wifi|4g|analog|камер|kamer|камеры)/i, icon: Camera, tone: "from-sky-500/30 to-indigo-500/10" },
  { test: /(shd|хранен|disk|диск|hdd|накопител|usb|flash)/i, icon: HardDrive, tone: "from-emerald-500/30 to-teal-500/10" },
  { test: /(коммутат|kommut|switch|маршрут|router|сеть|сетев)/i, icon: Network, tone: "from-cyan-500/30 to-blue-500/10" },
  { test: /(wifi|wi-fi|беспровод)/i, icon: Wifi, tone: "from-cyan-500/30 to-blue-500/10" },
  { test: /(сигнал|signal|пожар|охран)/i, icon: Bell, tone: "from-rose-500/30 to-orange-500/10" },
  { test: /(доступ|dostup|считыв|турникет|контрол)/i, icon: Fingerprint, tone: "from-violet-500/30 to-fuchsia-500/10" },
  { test: /(замк|zamk|lock)/i, icon: Lock, tone: "from-amber-500/30 to-yellow-500/10" },
  { test: /(домофон|domofon|вызывн|intercom)/i, icon: Phone, tone: "from-teal-500/30 to-emerald-500/10" },
  { test: /(кабел|cable|питан|блок|аксессуар|aksessuar)/i, icon: Cable, tone: "from-slate-400/30 to-slate-500/10" },
  { test: /(монитор|monitor|дисплей)/i, icon: Monitor, tone: "from-blue-500/30 to-indigo-500/10" },
  { test: /(инструмент|tool|монтаж)/i, icon: Wrench, tone: "from-orange-500/30 to-amber-500/10" },
];

/** Иконки, выбираемые админом (categories.icon). */
const ICON_BY_KEY: Record<string, LucideIcon> = {
  camera: Camera, server: Server, disk: HardDrive, network: Network, wifi: Wifi, bell: Bell, fingerprint: Fingerprint,
  lock: Lock, phone: Phone, cable: Cable, monitor: Monitor, tool: Wrench, package: Package,
};

/** Картинка категории; если файл не открылся (нет доступа к hasi.tj и т.п.) — показываем иконку вместо «битой» картинки. */
export function CategoryPicture({ src, className, fallback }: { src: string; className: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const url = productImageSrc(src);
  if (!url || failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className={className} />;
}

export function categoryVisual(category: Pick<FilterCategory, "slug" | "name"> & { icon?: string }) {
  const chosen = category.icon ? ICON_BY_KEY[category.icon] : undefined;
  if (chosen) return { icon: chosen, tone: "from-violet-500/30 to-indigo-500/10" };
  const hay = `${category.slug} ${category.name}`;
  return RULES.find((rule) => rule.test.test(hay)) ?? { icon: Package, tone: "from-violet-500/30 to-indigo-500/10" };
}

/**
 * Горизонтальная прокручиваемая панель категорий: плитка с иконкой и названием снизу.
 * Выбранная категория подсвечивается золотым неоновым контуром; смена категории — мягкая навигация без перезагрузки страницы.
 */
export function CategoryFilter({ categories, active = "", basePath = "/catalog", keepQuery = {}, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    el?.querySelector<HTMLElement>("[aria-current='true']")?.scrollIntoView({ inline: "center", block: "nearest" });
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, active, categories.length]);

  const hrefFor = (slug: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(keepQuery)) if (value) query.set(key, value);
    if (slug) query.set("category", slug);
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  const items: FilterCategory[] = [{ slug: "", name: "Все товары" }, ...categories];

  return (
    <nav aria-label="Категории товаров" className="relative">
      {edges.left ? (
        <button type="button" aria-label="Прокрутить влево" onClick={() => scrollBy(-1)} className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/40 bg-slate-900/90 text-amber-300 shadow-lg backdrop-blur sm:inline-flex">
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {edges.right ? (
        <button type="button" aria-label="Прокрутить вправо" onClick={() => scrollBy(1)} className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/40 bg-slate-900/90 text-amber-300 shadow-lg backdrop-blur sm:inline-flex">
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}

      <div ref={scroller} onScroll={measure} className="flex snap-x gap-3 overflow-x-auto px-1 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((category) => {
          const selected = category.slug === active;
          const visual = category.slug ? categoryVisual(category) : { icon: LayoutGrid, tone: "from-amber-400/30 to-violet-500/10" };
          const Icon = visual.icon;
          const className = `group relative flex w-[92px] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border p-3 text-center backdrop-blur transition duration-200 sm:w-[108px] ${
            selected
              ? "border-amber-300 bg-slate-900 shadow-[0_0_0_1px_rgba(252,211,77,.7),0_0_22px_rgba(251,191,36,.45)]"
              : "border-slate-200 bg-white/80 hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-[0_0_18px_rgba(124,58,237,.35)] dark:border-white/10 dark:bg-white/5"
          }`;
          const body = (
            <>
              <span className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${visual.tone} ring-1 ring-inset ${selected ? "ring-amber-300/60" : "ring-white/10"}`}>
                <CategoryPicture src={category.image ?? ""} className="h-full w-full bg-white object-contain p-1" fallback={
                  <Icon className={`h-7 w-7 transition ${selected ? "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,.9)]" : "text-violet-600 group-hover:text-violet-500 dark:text-sky-300"}`} />
                } />
              </span>
              <span className={`line-clamp-2 text-[11px] font-bold leading-tight sm:text-xs ${selected ? "text-amber-200" : "text-slate-700 dark:text-slate-200"}`}>{category.name}</span>
              {typeof category.count === "number" ? <span className="text-[10px] text-slate-400">{category.count}</span> : null}
            </>
          );
          return onSelect ? (
            <button key={category.slug || "all"} type="button" aria-current={selected ? "true" : undefined} onClick={() => onSelect(category.slug)} className={className}>{body}</button>
          ) : (
            <Link key={category.slug || "all"} href={hrefFor(category.slug)} aria-current={selected ? "true" : undefined} className={className}>{body}</Link>
          );
        })}
      </div>
    </nav>
  );
}
