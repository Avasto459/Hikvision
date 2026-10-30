// Импорт каталога из прайс-листов (data/price-catalog.json) в базу.
//   npm run catalog:import            → Turso (если заданы TURSO_*), иначе data/hasi.db
//   npm run catalog:import -- --local → только локальный data/hasi.db
// Скрипт идемпотентен: повторный запуск обновляет цены/остатки по slug и не создаёт дубликатов.
// Фотографии лежат в public/catalog/ (взяты из самих прайс-листов).
import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const CENTRAL_WAREHOUSE_ID = 'hasi-central';
const SOURCE_MARK = 'price-list'; // защищает товары от очистки скриптом sync-hasi-catalog

/** Правила наценки: TIANDY +5 %, остальные +15 %; курс 1 USD = 10 TJS (как в lib/pricing.ts). */
class PriceCalculator {
  constructor(rate = 10) { this.rate = rate; }
  markupFor(brand) { return String(brand).trim().toUpperCase() === 'TIANDY' ? 5 : 15; }
  retail(brand, usd) {
    const cents = Math.round(Number(usd) * 100);
    return Math.floor((cents * this.rate * (100 + this.markupFor(brand)) + 5000) / 10000);
  }
  purchase(usd) { return Math.round(Number(usd) * this.rate * 100) / 100; }
}

class CatalogFile {
  constructor(path) { this.path = path; }
  async load() {
    const data = JSON.parse(await readFile(this.path, 'utf8'));
    if (!Array.isArray(data.categories) || !Array.isArray(data.products)) throw new Error('Некорректный файл каталога.');
    return data;
  }
}

class CatalogRepository {
  constructor(db) { this.db = db; this.categoryIds = new Map(); }

  async upsertCategories(categories) {
    for (const c of categories) this.categoryIds.set(c.slug, `pl-cat-${c.slug}`);
    let sort = 1;
    for (const c of categories) {
      await this.db.execute({
        sql: `INSERT INTO categories(id,slug,name,subtitle,description,image,sourceUrl,sort,status,parentId) VALUES(?,?,?,?,?,?,?,?, 'published', ?)
              ON CONFLICT(slug) DO UPDATE SET name=excluded.name,image=excluded.image,parentId=excluded.parentId,status='published'`,
        args: [this.categoryIds.get(c.slug), c.slug, c.name, '', '', c.placeholder || '', '', sort++, c.parent ? this.categoryIds.get(c.parent) : null],
      });
    }
  }

  async upsertProduct(p, price, previousPrice, stock, purchase) {
    const now = new Date().toISOString();
    const categoryId = this.categoryIds.get(p.category);
    if (!categoryId) throw new Error(`Нет категории «${p.category}» для ${p.slug}`);
    await this.db.execute({
      sql: `INSERT INTO products(id,slug,name,shortDescription,description,sku,brand,images,specifications,price,previousPrice,image,sourceUrl,categoryId,featured,rating,stock,isPublished,createdAt,type)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,1,?,'product')
            ON CONFLICT(slug) DO UPDATE SET name=excluded.name,shortDescription=excluded.shortDescription,description=excluded.description,sku=excluded.sku,brand=excluded.brand,
              images=excluded.images,specifications=excluded.specifications,price=excluded.price,previousPrice=excluded.previousPrice,image=excluded.image,
              sourceUrl=excluded.sourceUrl,categoryId=excluded.categoryId,featured=excluded.featured,stock=excluded.stock`,
      args: [randomUUID(), p.slug, p.name, p.shortDescription || '', p.description || '', p.sku || '', p.brand, JSON.stringify([p.image]),
        JSON.stringify({ 'Модель': p.model }), price, previousPrice, p.image, SOURCE_MARK, categoryId, previousPrice ? 1 : 0, stock, now],
    });
    const row = (await this.db.execute({ sql: 'SELECT id FROM products WHERE slug=?', args: [p.slug] })).rows[0];
    const id = String(row.id);
    await this.db.execute({
      sql: `INSERT INTO offers_stock(id,warehouseId,productId,qty,purchasePrice,updatedAt) VALUES(?,?,?,?,?,?)
            ON CONFLICT(warehouseId,productId) DO UPDATE SET qty=excluded.qty,purchasePrice=excluded.purchasePrice,updatedAt=excluded.updatedAt`,
      args: [`${CENTRAL_WAREHOUSE_ID}:${id}`, CENTRAL_WAREHOUSE_ID, id, stock, purchase, now],
    });
  }
}

class PriceListImporter {
  constructor(file, repository, calculator) { this.file = file; this.repo = repository; this.calc = calculator; }
  async run() {
    const { categories, products, defaultStock } = await this.file.load();
    await this.repo.upsertCategories(categories);
    let done = 0;
    for (const p of products) {
      if (!p.slug || !p.name || !p.brand || !(p.priceUsd > 0)) { console.warn('Пропущено (пустые поля):', p.slug || p.name); continue; }
      const price = this.calc.retail(p.brand, p.priceUsd);
      const previous = p.prevUsd ? this.calc.retail(p.brand, p.prevUsd) : null;
      const stock = p.stockKnown ? Math.max(0, Number(p.stock) || 0) : defaultStock;
      await this.repo.upsertProduct(p, price, previous, stock, this.calc.purchase(p.priceUsd));
      done++;
    }
    return done;
  }
}

const localOnly = process.argv.includes('--local');
const url = process.env.TURSO_DATABASE_URL?.trim();
const token = process.env.TURSO_AUTH_TOKEN?.trim();
const useTurso = !localOnly && Boolean(url && token);
const db = useTurso ? createClient({ url, authToken: token }) : createClient({ url: 'file:data/hasi.db' });
try {
  const count = await new PriceListImporter(new CatalogFile('data/price-catalog.json'), new CatalogRepository(db), new PriceCalculator()).run();
  console.log(`Импортировано товаров: ${count}. База: ${useTurso ? 'Turso' : 'data/hasi.db'}.`);
} catch (error) {
  console.error('Импорт не выполнен:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
