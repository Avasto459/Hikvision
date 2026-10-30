import { buildProductName, canonicalBrand, MAX_PRICE_USD } from "@/lib/pricing";

/** Данные формы «Добавить товар» (одинаково проверяются в браузере и на сервере). */
export type DistributorProductInput = {
  brand: string;
  model: string;
  specs: string;
  categoryId: string;
  priceUsd: string;
  stock: string;
  description: string;
};

export type FieldErrors = Partial<Record<keyof DistributorProductInput | "images", string>>;

export const MAX_IMAGES = 6;

export const emptyDistributorProduct: DistributorProductInput = {
  brand: "", model: "", specs: "", categoryId: "", priceUsd: "", stock: "", description: "",
};

/** Только http(s)-ссылки, без пробелов и опасных схем (javascript:, data:, file:). */
export function isSafeImageUrl(value: string) {
  const url = value.trim();
  if (!url || url.length > 2048 || /\s/.test(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Парсит «12,5» / «12.5» → 12.5; всё остальное → NaN. */
export function parseUsd(value: string) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return NaN;
  return Number(text);
}

export function validateDistributorProduct(input: DistributorProductInput, imageCount: number): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.brand.trim()) errors.brand = "Укажите бренд.";
  else if (input.brand.trim().length > 60) errors.brand = "Бренд — не более 60 символов.";
  if (!input.model.trim()) errors.model = "Укажите модель / название.";
  else if (input.model.trim().length > 200) errors.model = "Модель — не более 200 символов.";
  if (input.specs.trim().length > 80) errors.specs = "Характеристики — не более 80 символов.";
  if (!input.categoryId.trim()) errors.categoryId = "Выберите категорию.";
  const usd = parseUsd(input.priceUsd);
  if (!Number.isFinite(usd) || usd <= 0 || usd > MAX_PRICE_USD) errors.priceUsd = "Цена в $ — число больше 0 (до 2 знаков после запятой).";
  if (!/^\d{1,7}$/.test(input.stock.trim() || "0")) errors.stock = "Количество — целое число от 0.";
  if (input.description.length > 5000) errors.description = "Описание — не более 5000 символов.";
  if (imageCount > MAX_IMAGES) errors.images = `Не более ${MAX_IMAGES} фотографий.`;
  return errors;
}

/** Итоговое наименование карточки: [Бренд] [Модель] [Характеристики]. */
export function productTitle(input: Pick<DistributorProductInput, "brand" | "model" | "specs">) {
  return buildProductName(input.brand, input.model, input.specs);
}

export { canonicalBrand };
