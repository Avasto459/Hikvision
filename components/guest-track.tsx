"use client";

import { FormEvent, useCallback, useState } from "react";
import { OrderTrackingMap, type TrackedOrder } from "@/components/order-tracking-map";
import type { TrackingView } from "@/lib/tracking";

type Found = { order: TrackedOrder; tracking: TrackingView };

const input = "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-amber-300";

/** Публичное отслеживание без входа: номер заказа + телефон. */
export function GuestTrack({ initialNumber = "" }: { initialNumber?: string }) {
  const [orderNumber, setOrderNumber] = useState(initialNumber);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<Found | null>(null);

  const lookup = useCallback(async (): Promise<Found> => {
    const res = await fetch("/api/track/lookup", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ orderNumber, phone }),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<Found> & { error?: string };
    if (!res.ok || !data.order || !data.tracking) throw new Error(data.error || "Не удалось найти заказ.");
    return { order: data.order, tracking: data.tracking };
  }, [orderNumber, phone]);

  const refresh = useCallback(async () => (await lookup()).tracking, [lookup]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setFound(await lookup());
    } catch (reason) {
      setFound(null);
      setError(reason instanceof Error ? reason.message : "Не удалось найти заказ.");
    } finally {
      setBusy(false);
    }
  }

  if (found) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setFound(null)} className="text-sm font-semibold text-amber-300 hover:underline">← Другой заказ</button>
        <OrderTrackingMap key={found.order.id} order={found.order} initial={found.tracking} fetchView={refresh} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur-xl sm:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Отслеживание заказа</p>
        <h1 className="mt-1 text-2xl font-black">Где мой заказ?</h1>
        <p className="mt-1 text-sm text-slate-300">Введите номер заказа и телефон, указанный при оформлении. Вход в аккаунт не нужен.</p>
      </div>
      <label className="block text-sm font-medium">Номер заказа
        <input required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="HM-251027-A1B2C3" autoComplete="off" className={`${input} mt-1`} />
      </label>
      <label className="block text-sm font-medium">Телефон
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+992 9XX XX XX XX" autoComplete="tel" className={`${input} mt-1`} />
      </label>
      {error ? <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
      <button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_18px_rgba(251,191,36,.45)] disabled:opacity-60">
        {busy ? "Ищем…" : "Отследить"}
      </button>
    </form>
  );
}
