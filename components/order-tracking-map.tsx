"use client";

import "leaflet/dist/leaflet.css";
import { MapPin, MessageCircle, PhoneCall } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TrackingAdminForm } from "@/components/tracking-admin-form";
import { formatTjs } from "@/lib/currency";
import { WHATSAPP_URL } from "@/lib/site-contacts";
import { distanceKm, etaLabel, nearestIndex, pointAlong, TRACK_STAGES, type LatLng, type TrackingView } from "@/lib/tracking";

export type TrackedOrder = {
  id: string;
  orderNumber: string;
  address: string;
  city: string;
  total: number;
  createdAt: string;
  items: { id: string; name: string; quantity: number; lineTotal: number }[];
};

type Props = {
  order: TrackedOrder;
  initial: TrackingView;
  isAdmin?: boolean;
  /** Свой способ обновления данных (для гостей по номеру+телефону); по умолчанию — API вошедшего пользователя. */
  fetchView?: () => Promise<TrackingView>;
};

type LeafletModule = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;
type LeafletMarker = import("leaflet").Marker;
type LeafletLine = import("leaflet").Polyline;

const MAP_CSS = `
.hasi-pin{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:9999px;font-size:19px;
  background:rgba(8,15,32,.92);border:2px solid var(--c);box-shadow:0 0 14px var(--c),0 0 3px var(--c) inset}
.hasi-pin.pulse::after{content:"";position:absolute;inset:-6px;border-radius:9999px;border:2px solid var(--c);animation:hasi-ping 1.6s ease-out infinite}
@keyframes hasi-ping{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.hasi-map .leaflet-container{background:#e5e7eb;font-family:inherit}
@media (prefers-reduced-motion:reduce){.hasi-pin.pulse::after{animation:none}}
`;

/** Реальный маршрут по дорогам (OSRM, OpenStreetMap). Ошибка/нет сети → null, карта рисует прямую линию. */
async function fetchRoadRoute(a: LatLng, b: LatLng, signal: AbortSignal): Promise<LatLng[] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    return coords && coords.length > 1 ? coords.map(([lng, lat]) => ({ lat, lng })) : null;
  } catch { return null; }
}

/** Адрес покупателя → координаты (Nominatim/OSM), кэш в браузере. Берём результат только рядом с городом. */
async function geocodeAddress(orderId: string, city: string, address: string, near: LatLng, signal: AbortSignal): Promise<LatLng | null> {
  const key = `hasi-geo:${orderId}`;
  try { const c = JSON.parse(localStorage.getItem(key) || "null") as LatLng | null; if (c && Number.isFinite(c.lat)) return c; } catch { /* нет кэша */ }
  const queries = [`${address}, ${city}, Таджикистан`, `${address}, ${city}`];
  for (const q of queries) {
    if (!address.trim()) break;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tj&accept-language=ru&q=${encodeURIComponent(q)}`, { signal });
      if (!res.ok) continue;
      const list = (await res.json()) as { lat: string; lon: string }[];
      const hit = list[0] ? { lat: Number(list[0].lat), lng: Number(list[0].lon) } : null;
      // Защита от «одноимённой улицы в другом городе»: не дальше 60 км от центра города заказа.
      if (hit && Number.isFinite(hit.lat) && distanceKm(hit, near) < 60) {
        try { localStorage.setItem(key, JSON.stringify(hit)); } catch { /* ignore */ }
        return hit;
      }
    } catch { /* пробуем следующий запрос */ }
  }
  return null;
}

function pin(L: LeafletModule, emoji: string, color: string, pulse = false) {
  return L.divIcon({
    className: "",
    html: `<div class="hasi-pin ${pulse ? "pulse" : ""}" style="--c:${color};position:relative">${emoji}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

/**
 * Статус заказа + интерактивная карта (Leaflet / OpenStreetMap).
 * Пока заказ «В пути», данные обновляются каждые 15 секунд без перезагрузки страницы.
 */
export function OrderTrackingMap({ order, initial, isAdmin = false, fetchView }: Props) {
  const [view, setView] = useState<TrackingView>(initial);
  const [error, setError] = useState("");
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leaflet = useRef<LeafletModule | null>(null);
  const layers = useRef<{ courier?: LeafletMarker; warehouse?: LeafletMarker; dest?: LeafletMarker; route?: LeafletLine; done?: LeafletLine }>({});
  const fitted = useRef<string>("");
  const [mapReady, setMapReady] = useState(false);
  const [geoDest, setGeoDest] = useState<LatLng | null>(null);
  const [road, setRoad] = useState<LatLng[] | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const destination = view.destinationExact ? view.destination : (geoDest ?? view.destination);
  const destKey = `${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;

  const refresh = useCallback(async () => {
    try {
      if (fetchView) {
        setView(await fetchView());
      } else {
        const res = await fetch(`/api/track/${order.id}`, { cache: "no-store" });
        const data = (await res.json()) as { tracking?: TrackingView; error?: string };
        if (!res.ok || !data.tracking) throw new Error(data.error || "Не удалось обновить данные.");
        setView(data.tracking);
      }
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить данные.");
    }
  }, [order.id, fetchView]);

  // Автообновление, пока заказ в пути.
  useEffect(() => {
    if (view.status !== "shipping") return;
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [view.status, refresh]);

  // Локальный «тик»: курьер плавно движется по маршруту между серверными обновлениями.
  useEffect(() => {
    if (view.status !== "shipping") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [view.status]);

  // Точный адрес покупателя: если админ не указал координаты — ищем адрес на карте.
  useEffect(() => {
    if (view.destinationExact) return;
    const ctrl = new AbortController();
    void geocodeAddress(order.id, order.city, order.address, view.destination, ctrl.signal).then((hit) => { if (hit && !ctrl.signal.aborted) setGeoDest(hit); });
    return () => ctrl.abort();
  }, [order.id, order.city, order.address, view.destinationExact, view.destination]);

  // Маршрут по дорогам склад → адрес.
  useEffect(() => {
    const ctrl = new AbortController();
    setRoad(null);
    void fetchRoadRoute(view.warehouse, destination, ctrl.signal).then((r) => { if (r && !ctrl.signal.aborted) setRoad(r); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey, view.warehouse.lat, view.warehouse.lng]);

  // Создание карты (один раз).
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const L = (await import("leaflet")).default as unknown as LeafletModule;
      if (disposed || !mapEl.current || mapRef.current) return;
      leaflet.current = L;
      const map = L.map(mapEl.current, { zoomControl: true, scrollWheelZoom: false }).setView([initial.warehouse.lat, initial.warehouse.lng], 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layers.current = {};
      fitted.current = "";
    };
  }, [initial.warehouse.lat, initial.warehouse.lng]);

  // Путь для рисования и расчёта положения: дорога (OSRM) или прямая линия.
  const path: LatLng[] = road ?? [view.warehouse, destination];

  // Прогресс и расчётное время считаем здесь, поэтому курьер двигается и между обновлениями сервера.
  const startMs = view.startedAt ? Date.parse(view.startedAt) : NaN;
  const etaMs = view.etaAt ? Date.parse(view.etaAt) : NaN;
  const liveProgress = Number.isFinite(startMs) && Number.isFinite(etaMs) && etaMs > startMs ? Math.min(0.97, Math.max(0.02, (nowMs - startMs) / (etaMs - startMs))) : view.progress;
  const courierPos: (LatLng & { live: boolean }) | null = view.status !== "shipping" ? null
    : view.courier?.live ? view.courier : { ...pointAlong(path, liveProgress), live: false };
  const etaMinutes = view.status !== "shipping" ? null
    : view.courier?.live ? view.etaMinutes : Number.isFinite(etaMs) ? Math.max(0, Math.ceil((etaMs - nowMs) / 60000)) : view.etaMinutes;

  const line = (pts: LatLng[]) => pts.map((q) => [q.lat, q.lng] as [number, number]);

  // Статичные элементы: склад, адрес, дорога. Перерисовываются только при смене адреса/маршрута.
  useEffect(() => {
    const L = leaflet.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;
    const w = view.warehouse;
    const d = destination;
    layers.current.route?.remove();
    layers.current.warehouse?.remove();
    layers.current.dest?.remove();
    layers.current.warehouse = L.marker([w.lat, w.lng], { icon: pin(L, "🏬", "#d97706"), title: w.name }).addTo(map).bindTooltip(w.name);
    layers.current.dest = L.marker([d.lat, d.lng], { icon: pin(L, "📍", "#db2777"), title: "Адрес доставки" }).addTo(map)
      .bindTooltip(view.destinationExact || geoDest ? "Адрес доставки" : "Адрес доставки (примерно, по городу)");
    layers.current.route = L.polyline(line(road ?? [w, d]), { color: "#2563eb", weight: 5, opacity: 0.6 }).addTo(map);
    const fitKey = `${destKey}|${road ? road.length : 0}`;
    if (fitted.current !== fitKey) {
      map.fitBounds(L.latLngBounds(line(road ?? [w, d])), { padding: [40, 40], maxZoom: 15 });
      fitted.current = fitKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey, road, mapReady, view.destinationExact, !!geoDest]);

  // Курьер и пройденная часть пути — двигаются каждые несколько секунд.
  useEffect(() => {
    const L = leaflet.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;
    layers.current.done?.remove();
    layers.current.done = undefined;
    const c = courierPos;
    if (!c) { layers.current.courier?.remove(); layers.current.courier = undefined; return; }
    const idx = nearestIndex(path, c);
    layers.current.done = L.polyline(line([...path.slice(0, idx + 1), c]), { color: "#f59e0b", weight: 6, opacity: 0.95 }).addTo(map);
    if (layers.current.courier) layers.current.courier.setLatLng([c.lat, c.lng]);
    else layers.current.courier = L.marker([c.lat, c.lng], { icon: pin(L, "🚚", "#0891b2", true), title: "Курьер" }).addTo(map).bindTooltip("Курьер");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courierPos?.lat, courierPos?.lng, mapReady, road, view.status]);

  const eta = etaLabel(etaMinutes);
  const phoneDigits = view.courierPhone.replace(/[^\d+]/g, "");
  const waDigits = phoneDigits.replace(/^\+/, "");

  return (
    <div className="space-y-6 text-white">
      <style>{MAP_CSS}</style>

      <header className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Отслеживание заказа</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">Заказ {order.orderNumber}</h1>
        {view.cancelled ? (
          <p className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">Заказ отменён.</p>
        ) : (
          <ol className="mt-6 grid gap-4 sm:grid-cols-4" aria-label="Статус заказа">
            {TRACK_STAGES.map((stage, i) => {
              const done = i < view.stage || view.status === "completed";
              const current = i === view.stage && view.status !== "completed";
              return (
                <li key={stage.key} aria-current={current ? "step" : undefined} className="relative flex items-start gap-3 sm:flex-col sm:items-center sm:text-center">
                  {i > 0 ? <span aria-hidden className={`absolute left-5 top-[-18px] h-[18px] w-0.5 sm:left-[-50%] sm:top-5 sm:h-0.5 sm:w-full ${i <= view.stage || view.status === "completed" ? "bg-amber-300 shadow-[0_0_8px_#fbbf24]" : "bg-white/15"}`} /> : null}
                  <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-lg transition ${
                    done ? "border-amber-300 bg-amber-300/15 shadow-[0_0_14px_rgba(251,191,36,.7)]"
                    : current ? "animate-pulse border-cyan-300 bg-cyan-300/15 shadow-[0_0_16px_rgba(34,211,238,.8)]"
                    : "border-white/15 bg-white/5 opacity-60"}`}>{stage.icon}</span>
                  <span>
                    <span className={`block text-sm font-bold ${done || current ? "text-white" : "text-slate-400"}`}>{stage.title}</span>
                    <span className="block text-xs text-slate-400">{stage.hint}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-[0_0_40px_-12px_rgba(56,189,248,.5)]">
          <div className="hasi-map">
            <div ref={mapEl} className="h-[340px] w-full sm:h-[460px]" role="region" aria-label="Карта доставки" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-4 text-sm">
            <p className="font-bold text-cyan-300">
              {view.status === "shipping" ? (eta || "Курьер в пути") : view.status === "completed" ? "Заказ доставлен" : view.cancelled ? "Заказ отменён" : "Доставка начнётся после сборки"}
            </p>
            {courierPos ? (
              <p className="text-xs text-slate-400">{courierPos.live ? "Положение курьера по GPS" : "Курьер движется по маршруту (расчёт по времени в пути)"}</p>
            ) : null}
          </div>
          {error ? <p role="alert" className="border-t border-white/10 p-3 text-xs text-rose-300">{error}</p> : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-300">Курьер</h2>
            <p className="mt-2 text-lg font-black">{view.courierName}</p>
            {view.courierPhone ? <p className="text-sm text-slate-300">{view.courierPhone}</p> : null}
            <div className="mt-4 grid gap-2">
              {phoneDigits ? (
                <a href={`tel:${phoneDigits}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold shadow-[0_0_16px_rgba(34,211,238,.4)] hover:brightness-110">
                  <PhoneCall className="h-4 w-4" />Позвонить курьеру
                </a>
              ) : null}
              <a href={waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`Здравствуйте! Вопрос по заказу ${order.orderNumber}`)}` : WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold hover:bg-emerald-500">
                <MessageCircle className="h-4 w-4" />Написать в WhatsApp
              </a>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-300">Адрес доставки</h2>
            <p className="mt-2 flex gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" /><span>{order.city}, {order.address}</span></p>
            {!view.destinationExact && !geoDest ? <p className="mt-2 text-xs text-slate-400">Точка на карте примерная — по городу. Администратор может уточнить координаты.</p> : null}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-300">Состав заказа</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3"><span className="min-w-0 break-words text-slate-200">{item.name} × {item.quantity}</span><span className="shrink-0 font-semibold">{formatTjs(item.lineTotal)}</span></li>
              ))}
            </ul>
            <p className="mt-4 flex justify-between border-t border-white/10 pt-3 text-base font-black"><span>Итого</span><span className="text-amber-300">{formatTjs(order.total)}</span></p>
          </section>
        </aside>
      </div>

      {isAdmin ? <TrackingAdminForm orderId={order.id} status={view.status} onSaved={() => void refresh()} /> : null}
    </div>
  );
}
