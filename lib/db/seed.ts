import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "./db";
import { initializeSchema } from "./schema";
import { seedProducts } from "@/lib/seed-products";

const categories = [
  ["category-ip-cameras","ip-kamery","IP-камеры","Сетевые камеры видеонаблюдения"],
  ["category-wifi-cameras","wifi-kamery","Wi-Fi камеры","Беспроводные камеры для дома и бизнеса"],
  ["category-outdoor-cameras","ulichnye-kamery","Уличные камеры","Камеры для наружного наблюдения"],
  ["category-indoor-cameras","kamery-dlya-pomeshcheniy","Камеры для помещений","Видеонаблюдение внутри помещений"],
  ["category-ptz-cameras","ptz-kamery","PTZ камеры","Поворотные камеры с удалённым управлением"],
  ["category-recorders","videoregistratory","Видеорегистраторы","NVR и DVR для записи видео"],
  ["category-kits","komplekty-videonablyudeniya","Комплекты видеонаблюдения","Готовые комплекты для объектов"],
  ["category-hard-drives","zhestkie-diski","Жёсткие диски","Накопители для систем видеонаблюдения"],
  ["category-cables","kabeli","Кабели","Кабели для видеонаблюдения"],
  ["category-power","bloki-pitaniya","Блоки питания","Питание и PoE оборудование"],
  ["category-ahd","ahd-kamery","AHD камеры","Аналоговые HD камеры"],
  ["category-home","kamery-dlya-doma","Камеры для дома","Решения для дома"],
  ["category-business","kamery-dlya-biznesa","Камеры для бизнеса","Решения для бизнеса"],
  ["category-accessories","aksessuary","Аксессуары","Монтажные аксессуары"]
] as const;

const settings: Record<string,string> = {
  site_name: "HASI.TJ", phone: "", address: "", about: "Интернет-магазин систем видеонаблюдения.",
  currency: "TJS", telegram_bot_token: "", telegram_chat_id: ""
};

// Приведение адреса картинки к полному внешнему URL — та же логика, что в
// scripts/sync-hasi-catalog.mjs: локальные пути (/products/..., products/...)
// превращаются в прямые ссылки https://hasi.tj/..., готовые для Vercel.
function toSeedImageUrl(raw: unknown): string {
  const value = String(raw || "").trim();
  if (/^https:\/\//i.test(value)) return value;
  if (/^http:\/\//i.test(value)) return value.replace(/^http:\/\//i, "https://");
  if (value.startsWith("//")) return `https:${value}`;
  if (!value || /^(data:image\/|blob:)/i.test(value)) return "";
  const host = "https://hasi.tj";
  if (value.startsWith("/")) {
    // WooCommerce хранит медиа в /wp-content/uploads/...; если в БД лежит
    // укороченный путь /uploads/..., подставляем wp-content/ между хостом и путём.
    if (value.startsWith("/uploads/") && !value.startsWith("/wp-content/")) {
      return `${host}/wp-content${value}`;
    }
    return `${host}${value}`;
  }
  if (/^hasi\.tj\//i.test(value)) return `https://${value}`;
  return `${host}/${value}`;
}

let ready: Promise<void> | null = null;

export async function initializeDatabase() {
  if (ready) return ready;
  ready = (async () => {
    try { await initializeSchema(); } catch (error) {
      console.warn("Пропущена инициализация схемы (БД только для чтения или уже инициализирована):", error instanceof Error ? error.message : error);
    }
    try {
      for (let i=0;i<categories.length;i++) {
        const [id,slug,name,subtitle] = categories[i];
        await db.execute({sql:`INSERT INTO categories (id,slug,name,subtitle,description,image,sort,status) VALUES (?,?,?,?,?,?,?,'published') ON CONFLICT(id) DO NOTHING`,args:[id,slug,name,subtitle,subtitle,"",i]});
      }
    } catch (error) {
      console.warn("Пропущено заполнение категорий (БД только для чтения):", error instanceof Error ? error.message : error);
    }
    try {
      for (const [key,value] of Object.entries(settings)) await db.execute({sql:`INSERT INTO settings(key,value,updatedAt) VALUES(?,?,?) ON CONFLICT(key) DO NOTHING`,args:[key,value,new Date().toISOString()]});
    } catch (error) {
      console.warn("Пропущено заполнение настроек (БД только для чтения):", error instanceof Error ? error.message : error);
    }
    const count = await db.execute(`SELECT COUNT(*) AS count FROM products`);
    // A fresh database first tries to pull the real catalogue, including live product photos and prices.
    // If the public WooCommerce API is unavailable, retain the bundled fallback catalogue.
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      let seededFromLiveSite = false;
      try {
        const site = (process.env.HASI_CATALOG_URL || "https://hasi.tj").replace(/\/$/, "");
        const liveProducts: any[] = [];
        for (let page = 1; page <= 100; page++) {
          const response = await fetch(`${site}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, { signal: AbortSignal.timeout(12000) });
          if (!response.ok) throw new Error(`HASI catalog API returned ${response.status}`);
          const batch = await response.json();
          if (!Array.isArray(batch)) throw new Error("Unexpected HASI catalog response");
          liveProducts.push(...batch);
          if (batch.length < 100) break;
        }
        if (liveProducts.length) {
          const categoryIds = new Map<string, string>();
          for (const p of liveProducts) {
            const category = Array.isArray(p.categories) && p.categories[0] ? p.categories[0] : { name: "Hikvision", slug: "hikvision" };
            const slug = String(category.slug || category.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "catalog";
            if (!categoryIds.has(slug)) {
              const id = `hasi-cat-${slug}`;
              await db.execute({sql:`INSERT INTO categories(id,slug,name,subtitle,description,image,sourceUrl,sort,status) VALUES(?,?,?,?,?,?,?,?, 'published') ON CONFLICT(slug) DO NOTHING`,args:[id,slug,String(category.name || "Каталог"),String(category.name || "Каталог"),`Категория товаров с ${site}`,"",`${site}/product-category/${slug}/`,categoryIds.size]});
              const saved = await db.execute({sql:"SELECT id FROM categories WHERE slug=? LIMIT 1",args:[slug]});
              categoryIds.set(slug,String(saved.rows[0].id));
            }
            const name = String(p.name || p.sku || `Товар ${p.id}`);
            const productSlug = String(p.slug || name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || `item-${p.id}`;
            const images = (Array.isArray(p.images) ? p.images : [])
              .map((i: any) => toSeedImageUrl(i?.src ?? i?.thumbnail ?? i?.url ?? ""))
              .filter((src: any) => typeof src === "string" && src.length > 0);
            const minor = Number(p.prices?.currency_minor_unit ?? 2);
            const rawPrice = Number(p.prices?.price ?? p.price ?? 0);
            const price = Number.isFinite(rawPrice) ? rawPrice / (10 ** minor) : 0;
            const rawRegular = Number(p.prices?.regular_price ?? 0);
            const previousPrice = rawRegular > rawPrice ? rawRegular / (10 ** minor) : null;
            const description = String(p.description || p.short_description || name).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
            const short = String(p.short_description || p.description || name).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,450);
            const image = images[0] || "";
            await db.execute({sql:`INSERT INTO products(id,slug,name,shortDescription,description,sku,brand,images,specifications,price,previousPrice,image,sourceUrl,categoryId,featured,rating,stock,isPublished,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING`,args:[`hasi-${productSlug}`,productSlug,name,short,description,String(p.sku || ""),/hikvision/i.test(`${name} ${description}`) ? "Hikvision" : "HASI Technology",JSON.stringify(images),JSON.stringify({source:"hasi.tj"}),price,previousPrice,image,String(p.permalink || `${site}/?post_type=product&p=${p.id}`),categoryIds.get(slug),p.is_featured ? 1 : 0,5,p.is_in_stock ? 10 : 0,1,new Date().toISOString()]});
          }
          seededFromLiveSite = true;
        }
      } catch (error) {
        console.warn("HASI live catalogue could not be fetched; using bundled seed products:", error instanceof Error ? error.message : error);
      }
      if (!seededFromLiveSite) {
        try {
          for (const p of seedProducts) {
            const cat = categories.find(x => x[1] === p.category);
            if (!cat) continue;
            await db.execute({sql:`INSERT INTO products(id,slug,name,shortDescription,description,sku,brand,images,specifications,price,previousPrice,image,sourceUrl,categoryId,featured,rating,stock,isPublished,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING`,args:[`seed-${p.slug}`,p.slug,p.name,p.short,p.short,p.sku,p.brand,JSON.stringify([p.image]),JSON.stringify(p.specs),p.price,p.previousPrice ?? null,p.image,"",cat[0],p.featured ? 1 : 0,5,p.stock,1,new Date().toISOString()]});
          }
        } catch (error) {
          console.warn("Пропущено заполнение демо-товаров (БД только для чтения):", error instanceof Error ? error.message : error);
        }
      }
    }
    // Provision exactly one administrator account. Use a configured address or the primary default.
    const adminEmail = (process.env.HASI_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "najmiddinovavasto5@gmail.com").trim().toLowerCase();
    const adminPassword = process.env.HASI_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(adminPassword, 12);
    const found = await db.execute({sql:`SELECT id FROM users WHERE lower(email)=? LIMIT 1`,args:[adminEmail]});
    if (!found.rows.length) {
      await db.execute({sql:`INSERT INTO users(id,firstName,lastName,email,phone,passwordHash,role,emailVerified,isBlocked,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?)`,args:[randomUUID(),"HASI","Admin",adminEmail,"",hash,"ADMIN",1,0,new Date().toISOString()]});
    } else {
      await db.execute({sql:`UPDATE users SET passwordHash=?,role='ADMIN',emailVerified=1,isBlocked=0 WHERE lower(email)=?`,args:[hash,adminEmail]});
    }
  })();
  try { await ready; } catch(e) { ready=null; throw e; }
}
