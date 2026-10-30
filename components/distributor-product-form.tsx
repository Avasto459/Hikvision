"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { PickedImage, ProductImagePicker } from "@/components/product-image-picker";
import { formatTjs } from "@/lib/currency";
import {
  DistributorProductInput, emptyDistributorProduct, FieldErrors, parseUsd, productTitle, validateDistributorProduct,
} from "@/lib/distributor-product";
import { KNOWN_BRANDS, priceCalculator } from "@/lib/pricing";

type Category = { id: string; name: string; parentId: string | null };
type MyProduct = { id: string; name: string; brand: string; price: number; stock: number; image: string; isPublished: number };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const labelClass = "block text-xs font-semibold text-slate-600 dark:text-slate-300";
const OTHER = "__other";

type EditData = { id: string; name: string; brand: string; categoryId: string; description: string; stock: number; priceUsd: number; images: string[] };

/** Модель для формы: название без бренда в начале. */
function modelFromName(name: string, brand: string) {
  const n = name.trim();
  return brand && n.toUpperCase().startsWith(`${brand.toUpperCase()} `) ? n.slice(brand.length).trim() : n;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className={labelClass}>
      {label}
      <div className="mt-1">{children}</div>
      {error ? <span role="alert" className="mt-1 block font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}

/** Форма добавления товара дистрибьютором: цена в $, розница в сомони считается автоматически. */
export function DistributorProductForm({ distributorName }: { distributorName: string }) {
  const [values, setValues] = useState<DistributorProductInput>(emptyDistributorProduct);
  const [brandChoice, setBrandChoice] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [mine, setMine] = useState<MyProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keptImages, setKeptImages] = useState<string[]>([]);

  const set = <K extends keyof DistributorProductInput>(key: K, value: DistributorProductInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch("/api/distributor/products", { cache: "no-store" });
      const data = (await res.json()) as { products?: MyProduct[] };
      if (res.ok) setMine(data.products ?? []);
    } catch { /* список необязателен для работы формы */ }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/categories");
        const data = (await res.json()) as { categories?: Category[] };
        setCategories(data.categories ?? []);
      } catch { setToast({ ok: false, text: "Не удалось загрузить категории." }); }
    })();
    void loadMine();
  }, [loadMine]);

  function resetForm() {
    setValues(emptyDistributorProduct);
    setBrandChoice("");
    setImages([]);
    setKeptImages([]);
    setErrors({});
    setEditingId(null);
  }

  async function startEdit(id: string) {
    setToast(null);
    try {
      const res = await fetch(`/api/distributor/products/${id}`, { cache: "no-store" });
      const data = (await res.json()) as { product?: EditData; error?: string };
      if (!res.ok || !data.product) throw new Error(data.error || "Не удалось загрузить товар.");
      const p = data.product;
      setEditingId(p.id);
      setBrandChoice((KNOWN_BRANDS as readonly string[]).includes(p.brand) ? p.brand : p.brand ? OTHER : "");
      setValues({
        brand: p.brand, model: modelFromName(p.name, p.brand), specs: "", categoryId: p.categoryId,
        priceUsd: String(p.priceUsd), stock: String(p.stock), description: p.description,
      });
      setKeptImages(p.images);
      setImages([]);
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setToast({ ok: false, text: error instanceof Error ? error.message : "Не удалось загрузить товар." });
    }
  }

  async function removeProduct(p: MyProduct) {
    if (!window.confirm(`Удалить товар «${p.name}»? Это действие нельзя отменить.`)) return;
    try {
      const res = await fetch(`/api/distributor/products/${p.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось удалить товар.");
      if (editingId === p.id) resetForm();
      setToast({ ok: true, text: "Товар удалён." });
      void loadMine();
    } catch (error) {
      setToast({ ok: false, text: error instanceof Error ? error.message : "Не удалось удалить товар." });
    }
  }

  // Предпросмотр цены — только подсказка; окончательно цену считает сервер.
  const preview = useMemo(() => {
    const usd = parseUsd(values.priceUsd);
    if (!values.brand.trim() || !Number.isFinite(usd) || usd <= 0) return null;
    try { return priceCalculator.calculate(values.brand, usd); } catch { return null; }
  }, [values.brand, values.priceUsd]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = validateDistributorProduct(values, images.length + keptImages.length);
    setErrors(found);
    if (Object.keys(found).length) { setToast({ ok: false, text: "Проверьте выделенные поля." }); return; }

    const body = new FormData();
    (Object.keys(values) as (keyof DistributorProductInput)[]).forEach((key) => body.append(key, values[key].trim()));
    if (editingId) for (const src of keptImages) body.append("keepImages", src);
    for (const item of images) {
      if (item.kind === "file") body.append("images", item.file, item.file.name);
      else body.append("imageUrls", item.url);
    }

    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(editingId ? `/api/distributor/products/${editingId}` : "/api/distributor/products", { method: editingId ? "PATCH" : "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось добавить товар.");
      setToast({ ok: true, text: editingId ? "Изменения сохранены." : "Товар добавлен. Администратор увидит, что его завезли вы." });
      resetForm();
      void loadMine();
    } catch (error) {
      setToast({ ok: false, text: error instanceof Error ? error.message : "Не удалось добавить товар." });
    } finally {
      setBusy(false);
    }
  }

  const isKnown = (KNOWN_BRANDS as readonly string[]).includes(brandChoice);
  const title = productTitle(values);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div>
          <h2 className="text-xl font-black">{editingId ? "Изменить товар" : "Добавить товар"}</h2>
          <p className="text-sm text-slate-500">Поставщик: <b className="text-emerald-700 dark:text-emerald-300">{distributorName || "—"}</b> — имя сохранится в карточке автоматически.</p>
        </div>

        {toast ? <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ${toast.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{toast.text}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Бренд *" error={errors.brand}>
            <select
              value={brandChoice} className={inputClass}
              onChange={(e) => { setBrandChoice(e.target.value); set("brand", e.target.value === OTHER ? "" : e.target.value); }}
            >
              <option value="">— выберите —</option>
              {KNOWN_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value={OTHER}>Другой бренд…</option>
            </select>
          </Field>
          {brandChoice === OTHER || (brandChoice && !isKnown) ? (
            <Field label="Название бренда *">
              <input value={values.brand} maxLength={60} onChange={(e) => set("brand", e.target.value)} className={inputClass} placeholder="Например, Uniview" />
            </Field>
          ) : null}
          <Field label="Модель / название *" error={errors.model}>
            <input value={values.model} maxLength={200} onChange={(e) => set("model", e.target.value)} className={inputClass} placeholder="DS-2CD1023G2-LIU" />
          </Field>
          <Field label="Основные характеристики" error={errors.specs}>
            <input value={values.specs} maxLength={80} onChange={(e) => set("specs", e.target.value)} className={inputClass} placeholder="4MP / HDD 4TB" />
          </Field>
          <Field label="Категория *" error={errors.categoryId}>
            <select value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
              <option value="">— выберите —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}
            </select>
          </Field>
          <Field label="Цена закупки, $ *" error={errors.priceUsd}>
            <input value={values.priceUsd} inputMode="decimal" onChange={(e) => set("priceUsd", e.target.value)} className={inputClass} placeholder="31 или 66,50" />
          </Field>
          <Field label="Количество, шт" error={errors.stock}>
            <input value={values.stock} inputMode="numeric" onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} className={inputClass} placeholder="0" />
          </Field>
        </div>

        <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50 p-3 text-sm dark:border-violet-500/40 dark:bg-violet-500/10">
          {preview ? (
            <>
              <p className="font-semibold">Розничная цена: <span className="text-lg font-black text-violet-700 dark:text-violet-300">{formatTjs(preview.retailTjs)}</span></p>
              <p className="text-xs text-slate-500">{preview.priceUsd} $ × {preview.rateTjs} × {(1 + preview.markupPercent / 100).toFixed(2)} ({preview.markupLabel})</p>
            </>
          ) : <p className="text-xs text-slate-500">Укажите бренд и цену в $ — розничная цена в сомони посчитается автоматически (TIANDY +5%, остальные +15%, курс 1$ = 10 TJS).</p>}
        </div>

        <Field label="Описание" error={errors.description}>
          <textarea value={values.description} maxLength={5000} rows={3} onChange={(e) => set("description", e.target.value)} className={inputClass} />
        </Field>

        <div>
          <p className={labelClass}>Фотографии</p>
          {keptImages.length ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {keptImages.map((src) => (
                <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-contain" />
                  <button type="button" aria-label="Убрать фото" onClick={() => setKeptImages((cur) => cur.filter((x) => x !== src))} className="absolute right-0 top-0 rounded-bl-lg bg-rose-600 px-1.5 text-xs font-bold text-white">×</button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-1"><ProductImagePicker value={images} onChange={setImages} error={errors.images} disabled={busy} /></div>
        </div>

        {title ? <p className="break-words text-xs text-slate-500">Наименование в каталоге: <b className="text-slate-800 dark:text-slate-100">{title}</b></p> : null}

        <button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-violet-700 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-700/20 transition disabled:opacity-60 sm:w-auto">
          {busy ? "Сохраняем…" : editingId ? "Сохранить изменения" : "Добавить товар"}
        </button>
        {editingId ? <button type="button" onClick={resetForm} className="ml-0 mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold sm:ml-2 sm:mt-0 sm:w-auto">Отмена</button> : null}
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-black">Мои товары ({mine.length})</h2>
        {mine.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Вы пока ничего не добавили.</p> : null}
        {mine.map((p) => (
          <ProductCard key={p.id} compact showSupplier product={{ ...p, distributor_id: "me", distributor_name: distributorName }} />
        ))}
      </section>
    </div>
  );
}
