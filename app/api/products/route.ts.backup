import { NextResponse } from "next/server";
import { getProducts } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get("category") || undefined;
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const featured = url.searchParams.get("featured") === "true";
  const brand = url.searchParams.get("brand") || undefined;
  const minPriceValue = url.searchParams.get("minPrice");
  const maxPriceValue = url.searchParams.get("maxPrice");
  const minPrice = minPriceValue !== null && minPriceValue.trim() !== "" ? Number(minPriceValue) : undefined;
  const maxPrice = maxPriceValue !== null && maxPriceValue.trim() !== "" ? Number(maxPriceValue) : undefined;
  if (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) {
    return NextResponse.json({ error: "Укажите корректную минимальную цену." }, { status: 400 });
  }
  if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
    return NextResponse.json({ error: "Укажите корректную максимальную цену." }, { status: 400 });
  }
  const rawLimit = Number(url.searchParams.get("limit") || 12);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 12;
  const ids = url.searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean);
  const requestedSort = url.searchParams.get("sort");
  const sort = requestedSort === "price-asc" || requestedSort === "price-desc" || requestedSort === "name"
    ? requestedSort
    : "newest";

  const products = await getProducts({
    categorySlug,
    categoryId,
    search,
    featured,
    brand,
    minPrice,
    maxPrice,
    inStock: url.searchParams.get("inStock") === "true",
    sort,
    limit,
    ids,
  });

  // Автозамена локальных путей /uploads/... на рабочие полные URL сервера hasi.tj.
  const toAbsoluteImageUrl = (raw: string | string[] | null | undefined): string | string[] | null | undefined => {
    if (raw == null) return raw;
    if (typeof raw === "string") {
      const src = raw.trim();
      if (!src) return "";
      if (/^https:\/\//i.test(src)) return src;
      if (/^http:\/\//i.test(src)) return src.replace(/^http:\/\//i, "https://");
      if (src.startsWith("//")) return "https:" + src;
      if (/^\/(catalog|uploads\/products)\/|^\/products\/[^/]+\.svg$/.test(src)) return src;
      if (src.startsWith("/")) {
        // WooCommerce хранит медиа в /wp-content/uploads/...; если в БД лежит
        // укороченный путь /uploads/..., дополняем wp-content/ между хостом и путём.
        if (src.startsWith("/uploads/") && !src.startsWith("/wp-content/")) {
          return `https://hasi.tj/wp-content${src}`;
        }
        return `https://hasi.tj${src}`;
      }
      if (/^[a-z0-9-]+\/[a-z0-9-]+\/.*/i.test(src)) return "https://" + src;
      if (/^[a-z0-9_\-./]+\.(jpe?g|png|webp|gif|avif|svg)(\?.*)?$/i.test(src)) {
        return `https://hasi.tj/${src.replace(/^\.\//, "")}`;
      }
      return src;
    }
    return raw.map(toAbsoluteImageUrl) as string[];
  };

  const productsWithAbsoluteImages = products.map((p) => ({
    ...p,
    image: toAbsoluteImageUrl(p.image),
    images: toAbsoluteImageUrl(p.images),
  }));

  return NextResponse.json({ products: productsWithAbsoluteImages, total: productsWithAbsoluteImages.length });
}
