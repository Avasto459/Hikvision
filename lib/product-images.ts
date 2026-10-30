/** Публичная тестовая заглушка, показывается когда у товара нет фото. */
export const PLACEHOLDER_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1519389950437-497124c414a0?auto=format&fit=crop&w=600&q=80";
export const DEFAULT_PRODUCT_IMAGE = PLACEHOLDER_PRODUCT_IMAGE;

// ── Единый красивый placeholder-фото камеры ──





/** Публичный надежный placeholder — используется в onError, когда основной URL не отвечает. */
export const FALLBACK_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=500";

// Менее надёжный fallback для onError: универсальная иконка, не фото.

/** Быстрая проверка: URL пустой или содержит пробелы, которые точно сломают загрузку.
 *  Кириллица в URL допустима — encodeURI() корректно кодирует не-ASCII символы
 *  (например, имена файлов hasi.tj вроде "Снимок-экрана-...png"), а браузеры
 *  безупрежненно обрабатывают такие URL. */
export function isValidProductImage(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;        // не кодированные пробелы
  return true;
}

/** Базовый адрес сайта для абсолютных ссылок на изображения. */
function getSiteBase(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

function encode(value: string): string {
  // data: / blob: кодировать не нужно — иначе сломаем base64.
  if (/^(data:image\/|blob:)/i.test(value)) return value;
  return encodeURI(value);
}

/** Чужие «стоковые» заглушки из старых записей БД — это не фото товара. */
export function isPlaceholderImage(url: string): boolean {
  return /images\.unsplash\.com\/photo-(1519389950437|1557597774)/i.test(url);
}

/**
 * Адрес картинки для показа. Пустая строка = «фото нет»: компоненты (ProductImage, ProductThumb,
 * ProductGallery) сами рисуют локальную SVG-заглушку без обращения к сети.
 */
export function productImageSrc(source: string) {
  const base = getSiteBase();
  const value = (source ?? "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(value)) return encode(value);
  // Протокольно-относительные URL (//hasi.tj/...) — добавляем https:.
  if (value.startsWith("//")) return encode(`https:${value}`);
  // Локальные статичные ассеты проекта (SVG-заглушки /products/*.svg и /hasi-logo.png
  // лежат в public/ и раздаются самим Next.js) — оставляем как есть.
  // Всё остальное локальное (/products/....jpg, products/... и т.п.) — прямая ссылка
  // на оригинал с hasi.tj, чтобы картинка открывалась и локально, и на Vercel.
  // Свои файлы проекта: фото из прайс-листов (/catalog/…) и загрузки дистрибьюторов (/uploads/products/…).
  if (/^\/(catalog|uploads\/products)\/|^\/products\/[^/]+\.svg$/.test(value)) return encode(value);
  if (value === "/hasi-logo.png" || (/^\/products\/.+\.svg(\?.*)?$/i.test(value))) return encode(value);
  if (value.startsWith("public/")) return encode(`${base}/${value.slice("public/".length)}`);
  if (value.startsWith("./")) return encode(`${base}/${value.slice(2)}`);
  if (value.startsWith("/")) {
    // WooCommerce хранит медиа в /wp-content/uploads/...; если в БД лежит
    // укороченный путь /uploads/..., подставляем wp-content/ между хостом и путём.
    if (value.startsWith("/uploads/") && !value.startsWith("/wp-content/")) {
      return encode(`${base}/wp-content${value}`);
    }
    return encode(`${base}${value}`);
  }
  return encode(`${base}/${value}`);
}
