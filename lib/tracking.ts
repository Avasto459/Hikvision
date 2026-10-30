/**
 * Отслеживание заказа: чистые функции без доступа к БД (можно импортировать и в браузере).
 * Положение курьера: если задан GPS (courierLat/Lng) — берём его, иначе считаем по времени между
 * складом и адресом (ориентировочно) и честно помечаем это в интерфейсе.
 */
export type LatLng = { lat: number; lng: number };

export const WAREHOUSE: LatLng & { name: string } = { lat: 38.5598, lng: 68.787, name: "Склад HASI (Душанбе)" };

const CITIES: { match: RegExp; at: LatLng }[] = [
  { match: /душанбе|dushanbe/i, at: { lat: 38.5598, lng: 68.787 } },
  { match: /худжанд|хуҷанд|khujand/i, at: { lat: 40.2826, lng: 69.6222 } },
  { match: /бохтар|курган|qurghon|bokhtar/i, at: { lat: 37.8363, lng: 68.7803 } },
  { match: /куляб|кулоб|kulob/i, at: { lat: 37.9146, lng: 69.7843 } },
  { match: /хорог|хоруғ|khorog/i, at: { lat: 37.4897, lng: 71.5531 } },
  { match: /турсунзаде|tursunzoda/i, at: { lat: 38.5106, lng: 68.23 } },
  { match: /вахдат|vahdat/i, at: { lat: 38.5558, lng: 69.0127 } },
  { match: /истаравшан|istaravshan/i, at: { lat: 39.9144, lng: 69.0006 } },
];

export const TRACK_STAGES = [
  { key: "new", icon: "📥", title: "Заказ принят", hint: "Мы получили ваш заказ" },
  { key: "processing", icon: "📦", title: "Сборка на складе HASI", hint: "Комплектуем оборудование" },
  { key: "shipping", icon: "🚚", title: "В пути", hint: "Курьер везёт заказ" },
  { key: "completed", icon: "✅", title: "Доставлен", hint: "Заказ вручён" },
] as const;

export function stageIndex(status: string) {
  const i = TRACK_STAGES.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
}

/** Небольшой стабильный сдвиг по id заказа — чтобы адрес не совпадал в точности с центром города. */
function jitter(seed: string): LatLng {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const a = ((h & 0xffff) / 0xffff - 0.5) * 0.05;
  const b = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.05;
  return { lat: a, lng: b };
}

/** Приблизительные координаты адреса по городу (если админ не указал точные). */
export function guessDestination(city: string, seed: string): LatLng {
  const base = CITIES.find((c) => c.match.test(city))?.at ?? CITIES[0].at;
  const j = jitter(seed);
  return { lat: base.lat + j.lat, lng: base.lng + j.lng };
}

export function distanceKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export type TrackingRow = {
  courierName: string; courierPhone: string; courierLat: number | null; courierLng: number | null;
  destLat: number | null; destLng: number | null; startedAt: string | null; etaAt: string | null; updatedAt: string;
};

export type TrackingView = {
  status: string;
  stage: number;
  cancelled: boolean;
  warehouse: LatLng & { name: string };
  destination: LatLng;
  /** true — адрес задан точными координатами; false — это лишь центр города (карта уточнит адрес геокодером). */
  destinationExact: boolean;
  /** Время старта и расчётного прибытия (ISO): карта сама двигает курьера по дороге между ними. */
  startedAt: string | null;
  etaAt: string | null;
  courier: (LatLng & { live: boolean }) | null;
  courierName: string;
  courierPhone: string;
  etaMinutes: number | null;
  progress: number;
  updatedAt: string;
};

/** Собирает состояние для карты и таймлайна. `now` передаётся явно — функция остаётся чистой. */
export function buildTrackingView(
  order: { id: string; status: string; city: string },
  row: TrackingRow | null,
  now: number,
  defaults: { courierName: string; courierPhone: string },
): TrackingView {
  const destination = row?.destLat != null && row?.destLng != null
    ? { lat: row.destLat, lng: row.destLng }
    : guessDestination(order.city, order.id);
  const stage = stageIndex(order.status);
  const cancelled = order.status === "cancelled";

  let courier: TrackingView["courier"] = null;
  let etaMinutes: number | null = null;
  let progress = 0;
  let startedAt: string | null = row?.startedAt ?? null;
  let etaAt: string | null = row?.etaAt ?? null;

  if (order.status === "shipping") {
    // Если админ не записал старт — считаем от последнего обновления записи, иначе от «сейчас».
    const startMs = Date.parse(startedAt || row?.updatedAt || "") || now;
    if (!startedAt) startedAt = new Date(startMs).toISOString();
    // Нет ETA — оцениваем по прямой ×1.4 (поправка на дороги) при ~30 км/ч по городу, минимум 10 минут.
    if (!etaAt) {
      const roadMin = Math.max(10, Math.round(((distanceKm(WAREHOUSE, destination) * 1.4) / 30) * 60));
      etaAt = new Date(startMs + roadMin * 60000).toISOString();
    }
    const startedMs = Date.parse(startedAt);
    const etaMs = Date.parse(etaAt);
    etaMinutes = Math.max(0, Math.ceil((etaMs - now) / 60000));
    if (etaMs > startedMs) progress = Math.min(1, Math.max(0, (now - startedMs) / (etaMs - startedMs)));

    if (row?.courierLat != null && row?.courierLng != null) {
      courier = { lat: row.courierLat, lng: row.courierLng, live: true };
      // С GPS оцениваем остаток по расстоянию до адреса.
      etaMinutes = Math.max(1, Math.round(((distanceKm(courier, destination) * 1.4) / 30) * 60));
    } else {
      const p = Math.min(0.95, Math.max(0.03, progress));
      courier = {
        lat: WAREHOUSE.lat + (destination.lat - WAREHOUSE.lat) * p,
        lng: WAREHOUSE.lng + (destination.lng - WAREHOUSE.lng) * p,
        live: false,
      };
    }
  }
  if (order.status === "completed") progress = 1;

  return {
    status: order.status, stage, cancelled, warehouse: WAREHOUSE, destination, destinationExact: row?.destLat != null && row?.destLng != null,
    startedAt, etaAt, courier,
    courierName: row?.courierName || defaults.courierName,
    courierPhone: row?.courierPhone || defaults.courierPhone,
    etaMinutes, progress, updatedAt: row?.updatedAt ?? "",
  };
}

export function etaLabel(minutes: number | null) {
  if (minutes === null) return "";
  if (minutes <= 1) return "Курьер почти на месте";
  if (minutes < 60) return `Прибудет через ${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `Прибудет через ${h} ч${m ? ` ${m} мин` : ""}`;
}


/** Точка на ломаной на доле `fraction` (0…1) её длины — так курьер «едет» по дороге, а не по прямой. */
export function pointAlong(path: LatLng[], fraction: number): LatLng {
  if (path.length === 0) return WAREHOUSE;
  if (path.length === 1 || fraction <= 0) return path[0];
  if (fraction >= 1) return path[path.length - 1];
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) { const d = distanceKm(path[i - 1], path[i]); segs.push(d); total += d; }
  let left = total * fraction;
  for (let i = 0; i < segs.length; i++) {
    if (left <= segs[i] || i === segs.length - 1) {
      const t = segs[i] > 0 ? Math.min(1, left / segs[i]) : 0;
      return { lat: path[i].lat + (path[i + 1].lat - path[i].lat) * t, lng: path[i].lng + (path[i + 1].lng - path[i].lng) * t };
    }
    left -= segs[i];
  }
  return path[path.length - 1];
}

/** Индекс вершины ломаной, ближайшей к точке (для разделения «пройдено / осталось»). */
export function nearestIndex(path: LatLng[], p: LatLng): number {
  let best = 0, bestD = Infinity;
  path.forEach((q, i) => { const d = distanceKm(q, p); if (d < bestD) { bestD = d; best = i; } });
  return best;
}
