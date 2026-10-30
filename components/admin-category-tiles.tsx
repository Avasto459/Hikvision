"use client";

import { ImagePlus, Pencil, Plus } from "lucide-react";
import { CategoryPicture, categoryVisual } from "@/components/category-filter";

export type TileCategory = { id: string; name: string; slug: string; image: string; icon?: string; parentId: string | null; status: string };

type Props = {
  categories: TileCategory[];
  /** Количество товаров по id категории (подкатегории уже учтены в главной). */
  counts: Record<string, number>;
  selectedId: string;
  onSelect: (id: string) => void;
  onAddProduct: (id: string) => void;
  onAddSub: (id: string) => void;
  onEdit: (id: string) => void;
};

function Tile({ category, count, selected, onSelect }: { category: TileCategory; count: number; selected: boolean; onSelect: () => void }) {
  const visual = categoryVisual(category);
  const Icon = visual.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex w-36 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border text-left transition sm:w-44 ${
        selected
          ? "border-amber-300 bg-slate-900 shadow-[0_0_0_1px_rgba(252,211,77,.7),0_0_22px_rgba(251,191,36,.45)]"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-[0_0_18px_rgba(124,58,237,.35)] dark:border-white/10 dark:bg-white/5"
      }`}
    >
      <span className={`relative flex h-24 w-full items-center justify-center bg-gradient-to-br ${visual.tone} sm:h-28`}>
        <CategoryPicture src={category.image} className="h-full w-full bg-white object-contain p-2" fallback={
          <Icon className={`h-10 w-10 ${selected ? "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,.9)]" : "text-violet-600 dark:text-sky-300"}`} />
        } />
        {category.status === "draft" ? <span className="absolute left-2 top-2 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white">черновик</span> : null}
      </span>
      <span className="space-y-0.5 p-2.5">
        <span className={`line-clamp-2 block text-xs font-bold leading-tight sm:text-sm ${selected ? "text-amber-200" : "text-slate-800 dark:text-slate-100"}`}>{category.name}</span>
        <span className="block text-[11px] text-slate-400">{count} шт.</span>
      </span>
    </button>
  );
}

/** Визуальное управление категориями: плитки с картинками; выбранной категории — быстрые действия. */
export function AdminCategoryTiles({ categories, counts, selectedId, onSelect, onAddProduct, onAddSub, onEdit }: Props) {
  const mains = categories.filter((c) => !c.parentId);
  const selected = categories.find((c) => c.id === selectedId);
  const mainId = selected ? (selected.parentId ?? selected.id) : "";
  const subs = categories.filter((c) => c.parentId === mainId);
  const btn = "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition sm:text-sm";

  return (
    <div className="space-y-3">
      <div className="flex snap-x gap-3 overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {mains.map((c) => <Tile key={c.id} category={c} count={counts[c.id] ?? 0} selected={c.id === selectedId} onSelect={() => onSelect(c.id)} />)}
      </div>

      {subs.length ? (
        <div className="flex snap-x gap-3 overflow-x-auto border-l-2 border-violet-300 py-1 pl-3 [scrollbar-width:none] dark:border-violet-500/40 [&::-webkit-scrollbar]:hidden">
          {subs.map((c) => <Tile key={c.id} category={c} count={counts[c.id] ?? 0} selected={c.id === selectedId} onSelect={() => onSelect(c.id)} />)}
        </div>
      ) : null}

      {selected ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-300/5 p-3">
          <p className="mr-auto text-sm font-semibold">Выбрано: <span className="text-amber-600 dark:text-amber-300">{selected.name}</span></p>
          <button type="button" onClick={() => onAddProduct(selected.id)} className={`${btn} bg-gradient-to-r from-violet-700 to-indigo-600 text-white shadow`}><Plus className="h-4 w-4" />Товар / услуга сюда</button>
          {!selected.parentId ? <button type="button" onClick={() => onAddSub(selected.id)} className={`${btn} border border-violet-300 text-violet-700 dark:text-violet-300`}><Plus className="h-4 w-4" />Подкатегория</button> : null}
          <button type="button" onClick={() => onEdit(selected.id)} className={`${btn} border border-slate-300 dark:border-slate-600`}><Pencil className="h-4 w-4" />Изменить / фото</button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-xs text-slate-500"><ImagePlus className="h-4 w-4" />Выберите категорию, чтобы добавить в неё товар, подкатегорию или сменить фото.</p>
      )}
    </div>
  );
}
