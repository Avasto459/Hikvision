import { db } from "@/lib/db/db";
import { CENTRAL_WAREHOUSE_ID } from "@/lib/hasi-config";
import { hasiReady } from "@/lib/hasi";
import { productImageSrc } from "@/lib/product-images";

export type CatalogSort = "popular" | "price-asc" | "price-desc" | "name" | "newest";

export type CatalogQuery = {
  q?: string;
  brand?: string;
  category?: string;
  sort?: CatalogSort;
  inStock?: boolean;
  offset?: number;
  limit?: number;
};

export type CatalogItem = {
  id: string; slug: string; name: string; brand: string; price: number; previousPrice: number | null;
  stock: number; image: string; categoryName: string; categorySlug: string;
};

export type CatalogFacets = {
  brands: Array<{ name: string; count: number }>;
  categories: Array<{ slug: string; name: string; count: number; image: string; icon?: string; children: Array<{ slug: string; name: string; count: number; image: string }> }>;
  total: number;
};

const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => Number(v ?? 0);

/** Чтение каталога для кабинета дилера / дистрибьютора: фильтры, поиск, сортировка, постраничная выдача. */
export class PartnerCatalogRepository {
  private static readonly FROM = `FROM products p
      JOIN categories c ON c.id=p.categoryId
      LEFT JOIN categories pc ON pc.id=c.parentId
      LEFT JOIN offers_stock o ON o.productId=p.id AND o.warehouseId=?`;

  private where(q: CatalogQuery) {
    const clauses = ["p.isPublished=1", "p.type='product'"];
    const args: Array<string | number> = [CENTRAL_WAREHOUSE_ID];
    const text = (q.q ?? "").trim().slice(0, 80);
    for (const word of text.split(/\s+/).filter(Boolean).slice(0, 5)) {
      const like = `%${word.replace(/[%_\\]/g, "\\$&")}%`;
      clauses.push("(p.name LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\')");
      args.push(like, like, like, like);
    }
    if (q.brand) { clauses.push("UPPER(p.brand)=UPPER(?)"); args.push(q.brand); }
    if (q.category) { clauses.push("(c.slug=? OR pc.slug=?)"); args.push(q.category, q.category); }
    if (q.inStock) clauses.push("COALESCE(o.qty,p.stock,0) > 0");
    return { sql: clauses.join(" AND "), args };
  }

  async search(q: CatalogQuery): Promise<{ items: CatalogItem[]; total: number }> {
    await hasiReady();
    const w = this.where(q);
    const limit = Math.min(60, Math.max(1, Math.trunc(q.limit ?? 24)));
    const offset = Math.max(0, Math.trunc(q.offset ?? 0));
    const order = {
      "price-asc": "p.price ASC, p.name ASC",
      "price-desc": "p.price DESC, p.name ASC",
      name: "p.name COLLATE NOCASE ASC",
      newest: "datetime(p.createdAt) DESC, p.name ASC",
      popular: "(CASE WHEN COALESCE(o.qty,p.stock,0)>0 THEN 0 ELSE 1 END), (CASE WHEN p.previousPrice IS NOT NULL THEN 0 ELSE 1 END), p.brand, p.name",
    }[q.sort ?? "popular"] ?? "p.name";
    const [rows, count] = await Promise.all([
      db.execute({
        sql: `SELECT p.id,p.slug,p.name,p.brand,p.price,p.previousPrice,p.image,c.name AS categoryName,c.slug AS categorySlug,COALESCE(o.qty,p.stock,0) AS qty
              ${PartnerCatalogRepository.FROM} WHERE ${w.sql} ORDER BY ${order} LIMIT ? OFFSET ?`,
        args: [...w.args, limit, offset],
      }),
      db.execute({ sql: `SELECT COUNT(*) AS n ${PartnerCatalogRepository.FROM} WHERE ${w.sql}`, args: w.args }),
    ]);
    return {
      total: num(count.rows[0]?.n),
      items: rows.rows.map((r) => ({
        id: str(r.id), slug: str(r.slug), name: str(r.name), brand: str(r.brand), price: num(r.price),
        previousPrice: r.previousPrice == null ? null : num(r.previousPrice), stock: Math.max(0, num(r.qty)),
        image: productImageSrc(str(r.image)), categoryName: str(r.categoryName), categorySlug: str(r.categorySlug),
      })),
    };
  }

  /** Бренды и категории с количеством товаров (без учёта текущих фильтров — для навигации). */
  async facets(): Promise<CatalogFacets> {
    await hasiReady();
    const [brands, cats, total] = await Promise.all([
      db.execute("SELECT brand,COUNT(*) AS n FROM products WHERE isPublished=1 AND type='product' AND brand<>'' GROUP BY brand ORDER BY n DESC"),
      db.execute(`SELECT c.slug,c.name,c.parentId,c.sort,COUNT(p.id) AS n FROM categories c
                  LEFT JOIN products p ON p.categoryId=c.id AND p.isPublished=1 AND p.type='product'
                  WHERE c.status='published' GROUP BY c.id ORDER BY c.sort,c.name`),
      db.execute("SELECT COUNT(*) AS n FROM products WHERE isPublished=1 AND type='product'"),
    ]);
    const imageOf = await categoryImageMap();
    const iconRows = await db.execute("SELECT slug, icon FROM categories");
    const iconOf = new Map(iconRows.rows.map((x) => [str(x.slug), str(x.icon)]));
    const byId = new Map<string, { slug: string; name: string; own: number; children: Array<{ slug: string; name: string; count: number; image: string }> }>();
    const idOf = new Map<string, string>();
    const rows = cats.rows;
    // slug → id нужен для связи с parentId: берём из отдельного запроса
    const ids = await db.execute("SELECT id,slug FROM categories");
    for (const r of ids.rows) idOf.set(str(r.id), str(r.slug));
    for (const r of rows) if (!r.parentId) byId.set(str(r.slug), { slug: str(r.slug), name: str(r.name), own: num(r.n), children: [] });
    for (const r of rows) {
      if (!r.parentId) continue;
      const parent = byId.get(idOf.get(str(r.parentId)) ?? "");
      if (parent && num(r.n) > 0) parent.children.push({ slug: str(r.slug), name: str(r.name), count: num(r.n), image: imageOf.get(str(r.slug)) ?? "" });
    }
    const categories = [...byId.values()]
      .map((p) => ({ slug: p.slug, name: p.name, count: p.own + p.children.reduce((s, c) => s + c.count, 0), image: imageOf.get(p.slug) ?? "", icon: iconOf.get(p.slug) || undefined, children: p.children }))
      .filter((c) => c.count > 0);
    return { brands: brands.rows.map((r) => ({ name: str(r.brand), count: num(r.n) })), categories, total: num(total.rows[0]?.n) };
  }
}

export const partnerCatalog = new PartnerCatalogRepository();

/** slug категории → картинка: своя или фото одного из её товаров (с учётом подкатегорий). */
export async function categoryImageMap(): Promise<Map<string, string>> {
  await hasiReady();
  const r = await db.execute(`SELECT c.slug, COALESCE(NULLIF(c.image,''),
      (SELECT p.image FROM products p JOIN categories cc ON cc.id=p.categoryId
        WHERE (cc.id=c.id OR cc.parentId=c.id) AND p.isPublished=1
          AND (p.image LIKE '/catalog/%' OR p.image LIKE '/uploads/products/%' OR p.image LIKE 'https://hasi.tj/%')
        ORDER BY p.stock DESC LIMIT 1), '') AS img FROM categories c`);
  return new Map(r.rows.map((x) => [str(x.slug), str(x.img)]));
}

const SORTS: CatalogSort[] = ["popular", "price-asc", "price-desc", "name", "newest"];
/** Безопасно разбирает параметры запроса (любой мусор → значения по умолчанию). */
export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const sort = params.get("sort") as CatalogSort | null;
  return {
    q: params.get("q") ?? "",
    brand: (params.get("brand") ?? "").slice(0, 60),
    category: (params.get("category") ?? "").slice(0, 80),
    sort: sort && SORTS.includes(sort) ? sort : "popular",
    inStock: params.get("inStock") === "1",
    offset: Number(params.get("offset")) || 0,
    limit: Number(params.get("limit")) || 24,
  };
}
