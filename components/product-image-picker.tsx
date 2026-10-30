"use client";

import { Camera, FileUp, Link2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { shrinkImage } from "@/components/scan-picker";
import { isSafeImageUrl, MAX_IMAGES } from "@/lib/distributor-product";

/** Один элемент галереи: локальный файл (выбранный или снятый) либо внешняя ссылка. */
export type PickedImage =
  | { id: string; kind: "file"; file: File; source: "upload" | "camera" }
  | { id: string; kind: "url"; url: string };

const ALLOWED_TYPES = /^image\/(png|jpe?g|webp)$/;
const MAX_BYTES = 10 * 1024 * 1024;

const btn =
  "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-400 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-violet-300";
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white";

let counter = 0;
const nextId = () => `img-${Date.now()}-${counter++}`;

type Props = {
  value: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * Управление фотографиями товара. Три способа:
 *  1) «Выбрать файл» — загрузка с устройства;
 *  2) «Снять» — съёмка камерой (на телефоне — системная камера, на компьютере — веб-камера);
 *  3) «URL» — прямая ссылка на изображение.
 */
export function ProductImagePicker({ value, onChange, error, disabled }: Props) {
  const [localError, setLocalError] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const captureInput = useRef<HTMLInputElement>(null);
  const full = value.length >= MAX_IMAGES;

  const add = useCallback(
    (items: PickedImage[]) => {
      const room = MAX_IMAGES - value.length;
      if (items.length > room) setLocalError(`Можно добавить не более ${MAX_IMAGES} фотографий.`);
      else setLocalError("");
      if (room > 0) onChange([...value, ...items.slice(0, room)]);
    },
    [value, onChange],
  );

  async function acceptFiles(files: File[], source: "upload" | "camera") {
    setBusy(true);
    try {
      const ready: PickedImage[] = [];
      for (const raw of files) {
        const file = await shrinkImage(raw);
        if (!ALLOWED_TYPES.test(file.type)) { setLocalError("Допустимы только JPEG, PNG и WebP."); continue; }
        if (file.size > MAX_BYTES) { setLocalError("Размер фото — не более 10 МБ."); continue; }
        ready.push({ id: nextId(), kind: "file", file, source });
      }
      if (ready.length) add(ready);
    } finally {
      setBusy(false);
    }
  }

  function onFileInput(source: "upload" | "camera") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length) void acceptFiles(files, source);
    };
  }

  function addUrl() {
    const url = urlDraft.trim();
    if (!url) { setLocalError("Вставьте ссылку на изображение."); return; }
    if (!isSafeImageUrl(url)) { setLocalError("Ссылка должна начинаться с http:// или https://."); return; }
    if (value.some((item) => item.kind === "url" && item.url === url)) { setLocalError("Эта ссылка уже добавлена."); return; }
    add([{ id: nextId(), kind: "url", url }]);
    setUrlDraft("");
  }

  /** «Снять»: на устройствах с сенсорным экраном сразу открываем камеру телефона, на ПК — веб-камеру. */
  function onSnap() {
    const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (touch || !navigator.mediaDevices?.getUserMedia) captureInput.current?.click();
    else setCameraOpen(true);
  }

  const shownError = localError || error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className={`${btn} ${disabled || full ? "pointer-events-none opacity-50" : ""}`}>
          <FileUp className="h-4 w-4" /> Выбрать файл
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={disabled || full} onChange={onFileInput("upload")} />
        </label>
        <button type="button" onClick={onSnap} disabled={disabled || full} className={btn}>
          <Camera className="h-4 w-4" /> Снять
        </button>
        <input ref={captureInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFileInput("camera")} />
        <button type="button" onClick={() => setShowUrl((v) => !v)} disabled={disabled || full} className={btn} aria-expanded={showUrl}>
          <Link2 className="h-4 w-4" /> URL
        </button>
      </div>

      {showUrl ? (
        <div className="flex gap-2">
          <input
            type="url" inputMode="url" value={urlDraft} maxLength={2048} placeholder="https://…/photo.jpg"
            aria-label="Ссылка на изображение" className={inputClass}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
          />
          <button type="button" onClick={addUrl} className={`${btn} shrink-0`}>Добавить</button>
        </div>
      ) : null}

      {cameraOpen ? (
        <WebcamCapture
          onClose={() => setCameraOpen(false)}
          onError={setLocalError}
          onCapture={(file) => { setCameraOpen(false); void acceptFiles([file], "camera"); }}
        />
      ) : null}

      {busy ? <p className="text-xs text-slate-500">Обрабатываем фото…</p> : null}
      {shownError ? <p role="alert" className="text-xs font-medium text-rose-600">{shownError}</p> : null}

      {value.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {value.map((item, index) => (
            <PickedThumb key={item.id} item={item} main={index === 0} onRemove={() => onChange(value.filter((x) => x.id !== item.id))} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Фото пока нет. Первое фото станет главным (до {MAX_IMAGES} шт.; JPEG, PNG, WebP до 10 МБ).</p>
      )}
    </div>
  );
}

function PickedThumb({ item, main, onRemove }: { item: PickedImage; main: boolean; onRemove: () => void }) {
  const file = item.kind === "file" ? item.file : null;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setObjectUrl(null); return; }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [broken, setBroken] = useState(false);
  const src = item.kind === "url" ? item.url : objectUrl;
  const label = item.kind === "url" ? "URL" : item.source === "camera" ? "Снято" : "Файл";

  return (
    <li className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Фото товара" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full items-center justify-center p-1 text-center text-[10px] text-rose-600">Не открывается</div>
      )}
      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">{main ? "Главное · " : ""}{label}</span>
      <button type="button" onClick={onRemove} aria-label="Убрать фото" className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 shadow hover:bg-white">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/** Съёмка с веб-камеры в браузере (getUserMedia). Поток всегда останавливается при закрытии. */
function WebcamCapture({ onCapture, onClose, onError }: { onCapture: (file: File) => void; onClose: () => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().then(() => setReady(true)).catch(() => setReady(true));
        }
      })
      .catch(() => { onError("Нет доступа к камере. Разрешите камеру в браузере или выберите файл."); onClose(); });
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function snap() {
    const el = video.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext("2d")?.drawImage(el, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { onError("Не удалось сделать снимок."); return; }
      onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.85);
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-black/90 p-2 dark:border-slate-700">
      <video ref={video} playsInline muted className="max-h-72 w-full rounded-xl object-contain" />
      <div className="flex gap-2">
        <button type="button" onClick={snap} disabled={!ready} className={btn}><Camera className="h-4 w-4" /> Сделать снимок</button>
        <button type="button" onClick={onClose} className={btn}><X className="h-4 w-4" /> Закрыть</button>
      </div>
    </div>
  );
}
