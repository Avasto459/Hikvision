import { StoreError } from "@/lib/db";

export function parseProductImages(value: unknown, fallbackImage = "") {
  if (value === undefined) return fallbackImage ? [fallbackImage.trim()] : [];
  if (!Array.isArray(value) || value.length > 10 ||
      value.some((image) => typeof image !== "string" || image.length > 2048)) {
    throw new StoreError("Добавьте не более 10 корректных адресов изображений.", 400);
  }

  const images = value.map((image) => (image as string).trim()).filter(Boolean);
  if (images.some((image) =>
    !(/^https?:\/\/\S+$/i.test(image) || /^\/(?!\/)\S*$/.test(image) || /^[a-zA-Z0-9_-][a-zA-Z0-9_./?%#=&+-]*$/.test(image)))) {
    throw new StoreError("Изображение должно иметь HTTP(S)-адрес или относительный путь.", 400);
  }
  return [...new Set(images)];
}

export function parseProductSpecifications(value: unknown) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StoreError("Характеристики должны быть объектом с названиями и значениями.", 400);
  }

  const entries = Object.entries(value);
  if (entries.length > 50 || entries.some(([key, item]) =>
    !key.trim() || key.length > 100 || typeof item !== "string" || item.length > 500)) {
    throw new StoreError("Проверьте характеристики: не более 50 строк, до 100 символов в названии и 500 в значении.", 400);
  }
  return Object.fromEntries(entries.map(([key, item]) => [key.trim(), (item as string).trim()]));
}
