"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const STATUSES: [string, string][] = [
  ["new", "Заказ принят"], ["processing", "Сборка на складе"], ["shipping", "В пути"], ["completed", "Доставлен"], ["cancelled", "Отменён"],
];

const field = "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500";

/** Панель администратора: статус, курьер, координаты и время в пути. Показывается только администратору. */
export function TrackingAdminForm({ orderId, status, onSaved }: { orderId: string; status: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);

  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);

  /** Транслирует GPS этого устройства (телефон курьера/админа) в заказ: покупатель видит живое положение. */
  function toggleShare() {
    if (sharing) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null; setSharing(false); return;
    }
    if (!("geolocation" in navigator)) { setMsg({ ok: false, text: "Геолокация не поддерживается этим устройством." }); return; }
    setMsg(null);
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        if (Date.now() - lastSent.current < 10000) return; // не чаще раза в 10 секунд
        lastSent.current = Date.now();
        try {
          const res = await fetch(`/api/admin/orders/${orderId}/tracking`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }) });
          if (!res.ok) throw new Error();
          setMsg({ ok: true, text: "GPS передаётся покупателю." }); onSaved();
        } catch { setMsg({ ok: false, text: "Не удалось передать GPS." }); }
      },
      (err) => { setSharing(false); watchId.current = null; setMsg({ ok: false, text: err.code === 1 ? "Доступ к геолокации запрещён в браузере." : "Не удалось определить положение." }); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    setSharing(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const body: Record<string, string> = {};
    data.forEach((value, key) => { body[key] = String(value).trim(); });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить.");
      setMsg({ ok: true, text: "Сохранено." });
      onSaved();
    } catch (error) {
      setMsg({ ok: false, text: error instanceof Error ? error.message : "Не удалось сохранить." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl border border-amber-300/30 bg-amber-300/5 p-5 backdrop-blur-xl">
      <h2 className="text-sm font-bold uppercase tracking-wide text-amber-300">Управление доставкой (только админ)</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-300">Статус
          <select name="status" defaultValue={status} className={`${field} mt-1`}>{STATUSES.map(([v, l]) => <option key={v} value={v} className="text-slate-900">{l}</option>)}</select>
        </label>
        <label className="text-xs text-slate-300">Курьер<input name="courierName" maxLength={80} placeholder="Имя курьера" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate-300">Телефон курьера<input name="courierPhone" placeholder="+992…" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate-300">Время в пути, мин<input name="etaMinutes" inputMode="numeric" placeholder="35" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate-300">GPS курьера: широта<input name="courierLat" inputMode="decimal" placeholder="38.56" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate-300">GPS курьера: долгота<input name="courierLng" inputMode="decimal" placeholder="68.78" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate-300">Адрес: широта<input name="destLat" inputMode="decimal" className={`${field} mt-1`} /></label>
        <label className="text-xs text-slate-300">Адрес: долгота<input name="destLng" inputMode="decimal" className={`${field} mt-1`} /></label>
      </div>
      <p className="text-xs text-slate-400">Пустые поля не меняют сохранённые значения. Без GPS курьер едет по маршруту, рассчитанному по времени в пути. Если координаты адреса не заданы, карта ищет адрес покупателя сама (иначе — центр города).</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={toggleShare} className={`rounded-xl border px-4 py-2 text-sm font-bold ${sharing ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" : "border-white/20 text-white hover:bg-white/10"}`}>{sharing ? "● Передача GPS — остановить" : "Передавать GPS с этого устройства"}</button>
        <button disabled={busy} className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{busy ? "Сохраняем…" : "Сохранить"}</button>
        {msg ? <span role="status" className={`text-sm font-semibold ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
