import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "./client";
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

let ready: Promise<void> | null = null;

export async function initializeDatabase() {
  if (ready) return ready;
  ready = (async () => {
    await initializeSchema();
    for (let i=0;i<categories.length;i++) {
      const [id,slug,name,subtitle] = categories[i];
      await db.execute({sql:`INSERT INTO categories (id,slug,name,subtitle,description,image,sort,status) VALUES (?,?,?,?,?,?,?,'published') ON CONFLICT(id) DO NOTHING`,args:[id,slug,name,subtitle,subtitle,"",i]});
    }
    for (const [key,value] of Object.entries(settings)) await db.execute({sql:`INSERT INTO settings(key,value,updatedAt) VALUES(?,?,?) ON CONFLICT(key) DO NOTHING`,args:[key,value,new Date().toISOString()]});
    const count = await db.execute(`SELECT COUNT(*) AS count FROM products`);
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      for (const p of seedProducts) {
        const cat = categories.find(x => x[1] === p.category);
        if (!cat) continue;
        await db.execute({sql:`INSERT INTO products(id,slug,name,shortDescription,description,sku,brand,images,specifications,price,previousPrice,image,sourceUrl,categoryId,featured,rating,stock,isPublished,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING`,args:[`seed-${p.slug}`,p.slug,p.name,p.short,p.short,p.sku,p.brand,JSON.stringify([p.image]),JSON.stringify(p.specs),p.price,p.previousPrice ?? null,p.image,"",cat[0],p.featured ? 1 : 0,5,p.stock,1,new Date().toISOString()]});
      }
    }
    const adminEmail = (process.env.HASI_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@hasi.tj").trim().toLowerCase();
    const adminPassword = process.env.HASI_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123";
    const found = await db.execute({sql:`SELECT id FROM users WHERE lower(email)=? LIMIT 1`,args:[adminEmail]});
    const hash = await bcrypt.hash(adminPassword,12);
    if (!found.rows.length) await db.execute({sql:`INSERT INTO users(id,firstName,lastName,email,phone,passwordHash,role,emailVerified,isBlocked,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?)`,args:[randomUUID(),"HASI","Admin",adminEmail,"",hash,"ADMIN",1,0,new Date().toISOString()]});
    else await db.execute({sql:`UPDATE users SET role='ADMIN',emailVerified=1 WHERE lower(email)=?`,args:[adminEmail]});
  })();
  try { await ready; } catch(e) { ready=null; throw e; }
}
