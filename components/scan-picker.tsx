"use client";

import { Camera, FileUp, X } from "lucide-react";
import { useEffect, useState } from "react";

export const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpe?g|webp)|application\/pdf)$/;

/** Проверка выбранного файла; возвращает текст ошибки или null. */
export function checkScanFile(file: File | null): string | null {
  if (!file) return null;
  if (!ALLOWED.test(file.type)) return "Допустимые форматы: PNG, JPG, WEBP или PDF (фото HEIC сначала сохраните как JPG).";
  if (file.size > MAX_SCAN_BYTES) return "Файл больше 2 МБ — сделайте фото в меньшем размере или выберите другой файл.";
  return null;
}

/**
 * Фото с камеры телефона весит 3–8 МБ — на сервер оно не пройдёт. Поэтому уменьшаем до 1800 px по длинной
 * стороне и сохраняем как JPEG (≈ 300–700 КБ). Поворот по EXIF учитывается. PDF и маленькие файлы не трогаем.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= 900 * 1024 && ALLOWED.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // прозрачные PNG не должны стать чёрными
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "passport"}.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // формат не декодируется (например, HEIC) — отправим как есть, сервер проверит
  }
}

type Props = {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Уже сохранённый скан (при редактировании). */
  existing?: { url: string; mime: string } | null;
  onOpenExisting?: () => void;
  onError?: (message: string) => void;
};

const button =
  "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-400 hover:text-violet-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-violet-300";

/** Выбор скана одной стороны паспорта: «Снять камерой» (на телефоне открывает камеру) или «Выбрать файл». */
export function ScanPicker({ label, file, onChange, existing, onOpenExisting, onError }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.files?.[0] ?? null;
    event.target.value = ""; // позволяет выбрать тот же файл повторно
    if (!raw) return;
    setBusy(true);
    try {
      const ready = await shrinkImage(raw);
      const problem = checkScanFile(ready);
      if (problem) { onError?.(problem); return; }
      onChange(ready);
    } finally {
      setBusy(false);
    }
  }

  const isPdf = file?.type === "application/pdf";
  const hasExisting = Boolean(existing?.url);
  const existingPdf = existing?.mime === "application/pdf";

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-start gap-4">
        <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className="h-full w-full object-cover" />
          ) : isPdf ? (
            <span className="font-black text-rose-600">PDF</span>
          ) : hasExisting ? (
            <button type="button" onClick={onOpenExisting} aria-label={`Открыть: ${label}`} className="h-full w-full">
              {existingPdf
                ? <span className="font-black text-rose-600">PDF</span>
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={existing!.url} alt={label} className="h-full w-full object-cover" />}
            </button>
          ) : "нет"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{label}</p>
          <p className="mt-0.5 break-words text-xs text-slate-500">
            {busy ? "Обрабатываем фото…" : file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} КБ` : hasExisting ? "Загружен. Выберите файл, чтобы заменить." : "Не загружен"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={button}>
              <Camera className="h-4 w-4" /> Снять камерой
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
            </label>
            <label className={button}>
              <FileUp className="h-4 w-4" /> {hasExisting || file ? "Заменить файл" : "Выбрать файл"}
              <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={pick} />
            </label>
            {file ? (
              <button type="button" onClick={() => onChange(null)} className={`${button} text-rose-600`}><X className="h-4 w-4" /> Убрать</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
