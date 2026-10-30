/**
 * Расчёт розничных цен (USD → сомони) в стиле ООП: стратегия наценки на каждый бренд.
 *
 * Правила:
 *   1 USD = 10 TJS
 *   TIANDY            → USD × 10 × 1.05  (наценка 5 %)
 *   все остальные     → USD × 10 × 1.15  (наценка 15 %)
 *
 * Все вычисления ведутся в целых числах (центы и проценты), чтобы не было ошибок float
 * (например 66.5 × 10 × 1.15). Итог округляется до целого сомони (в БД цена — INTEGER).
 */

export const USD_TO_TJS = 10;

/** Бренды, которые предлагает форма; любой другой бренд тоже допустим и получает наценку 15 %. */
export const KNOWN_BRANDS = ["TIANDY", "Hikvision", "Dahua", "Western Digital", "Ruijie"] as const;

/** Допустимая цена закупки: не больше 1 000 000 $ (защита от мусорного ввода). */
export const MAX_PRICE_USD = 1_000_000;

export class PricingError extends Error {}

/** Стратегия наценки: один класс — одно правило. */
export interface MarkupStrategy {
  readonly label: string;
  /** Наценка в процентах (целое число). */
  readonly percent: number;
  appliesTo(brand: string): boolean;
}

export class TiandyMarkup implements MarkupStrategy {
  readonly label = "TIANDY +5%";
  readonly percent = 5;
  appliesTo(brand: string) {
    return normalizeBrandKey(brand) === "TIANDY";
  }
}

export class StandardMarkup implements MarkupStrategy {
  readonly label = "Стандарт +15%";
  readonly percent = 15;
  appliesTo() {
    return true;
  }
}

export type PriceBreakdown = {
  brand: string;
  priceUsd: number;
  rateTjs: number;
  markupPercent: number;
  markupLabel: string;
  /** Розничная цена в сомони, округлённая до целого. */
  retailTjs: number;
};

export class PriceCalculator {
  /** Порядок важен: первая подходящая стратегия выигрывает, StandardMarkup — запасная. */
  constructor(
    private readonly strategies: readonly MarkupStrategy[] = [new TiandyMarkup(), new StandardMarkup()],
    private readonly rate: number = USD_TO_TJS,
  ) {}

  strategyFor(brand: string): MarkupStrategy {
    const found = this.strategies.find((strategy) => strategy.appliesTo(brand));
    if (!found) throw new PricingError("Не найдено правило наценки для бренда.");
    return found;
  }

  calculate(brand: string, priceUsd: number): PriceBreakdown {
    const cleanBrand = typeof brand === "string" ? brand.trim() : "";
    if (!cleanBrand) throw new PricingError("Укажите бренд товара.");
    if (typeof priceUsd !== "number" || !Number.isFinite(priceUsd) || priceUsd <= 0 || priceUsd > MAX_PRICE_USD) {
      throw new PricingError("Цена в долларах должна быть числом больше 0.");
    }
    const cents = Math.round(priceUsd * 100);
    if (cents <= 0) throw new PricingError("Цена в долларах должна быть числом больше 0.");

    const strategy = this.strategyFor(cleanBrand);
    // сомони = центы/100 × курс × (100+наценка)/100  → делим на 100·100, умножаем на курс
    const retailTjs = Math.floor((cents * this.rate * (100 + strategy.percent) + 5_000) / 10_000);
    return {
      brand: cleanBrand,
      priceUsd: cents / 100,
      rateTjs: this.rate,
      markupPercent: strategy.percent,
      markupLabel: strategy.label,
      retailTjs,
    };
  }
}

export const priceCalculator = new PriceCalculator();

/** Бренд без регистра и лишних пробелов — для сравнения и фильтров. */
export function normalizeBrandKey(brand: string | null | undefined) {
  return String(brand ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/** Приводит бренд к каноничному написанию из списка (hikvision → Hikvision); иначе — как ввели. */
export function canonicalBrand(brand: string) {
  const cleaned = String(brand ?? "").trim().replace(/\s+/g, " ");
  const known = KNOWN_BRANDS.find((item) => normalizeBrandKey(item) === normalizeBrandKey(cleaned));
  return known ?? cleaned;
}

/** «Бренд Модель Характеристики», без дублирования бренда в начале модели. */
export function buildProductName(brand: string, model: string, specs = "") {
  const b = canonicalBrand(brand);
  let m = String(model ?? "").trim().replace(/\s+/g, " ");
  if (m.toUpperCase().startsWith(`${b.toUpperCase()} `)) m = m.slice(b.length).trim();
  const s = String(specs ?? "").trim().replace(/\s+/g, " ");
  return [b, m, s].filter(Boolean).join(" ");
}
