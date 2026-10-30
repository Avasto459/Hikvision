// Diagnostic script: replicates the exact flow of sync-hasi-catalog.mjs to find
// where "fetch failed" originates (hasi.tj fetch vs Turso db.execute).
import { createClient } from '@libsql/client';

const site = 'https://hasi.tj';
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken });

async function step(label, fn) {
  const t0 = Date.now();
  process.stdout.write(`${label} ... `);
  try {
    const out = await fn();
    console.log(`OK (${Date.now() - t0}ms)`, out ?? '');
    return out;
  } catch (e) {
    console.log(`FAIL (${Date.now() - t0}ms)`);
    console.log('  message:', e?.message);
    console.log('  cause  :', e?.cause?.code || e?.cause?.message || 'n/a');
    throw e;
  }
}

try {
  await step('STEP1 fetch products from hasi.tj', async () => {
    const r = await fetch(`${site}/wp-json/wc/store/v1/products?per_page=100&page=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HASI-TJ-CatalogSync/1.0; +https://hasi.tj)',
        Accept: 'application/json, text/plain, */*',
      },
      signal: AbortSignal.timeout(25000),
      redirect: 'follow',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return `${Array.isArray(d) ? d.length : '?'} items`;
  });

  await step('STEP2 Turso schema bootstrap', async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', sourceUrl TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'published')`);
    return 'categories table ok';
  });

  await step('STEP3 Turso second bootstrap', async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, shortDescription TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', sku TEXT NOT NULL DEFAULT '', brand TEXT NOT NULL DEFAULT '', images TEXT NOT NULL DEFAULT '[]', specifications TEXT NOT NULL DEFAULT '{}', price REAL NOT NULL DEFAULT 0, previousPrice REAL, image TEXT NOT NULL DEFAULT '', sourceUrl TEXT NOT NULL DEFAULT '', categoryId TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, rating REAL NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0, isPublished INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, FOREIGN KEY(categoryId) REFERENCES categories(id))`);
    return 'products table ok';
  });

  await step('STEP4 fetch categories from hasi.tj', async () => {
    const r = await fetch(`${site}/wp-json/wc/store/v1/products/categories?per_page=100&page=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HASI-TJ-CatalogSync/1.0; +https://hasi.tj)',
        Accept: 'application/json, text/plain, */*',
      },
      signal: AbortSignal.timeout(25000),
      redirect: 'follow',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return `${Array.isArray(d) ? d.length : '?'} categories`;
  });

  await step('STEP5 Turso SELECT count', async () => {
    const r = await db.execute('SELECT COUNT(*) AS n FROM products');
    return `${r.rows[0].n} products in Turso`;
  });

  console.log('ALL STEPS OK');
} catch (e) {
  console.log('ABORTED at failing step above');
  process.exitCode = 1;
} finally {
  await db.close();
}
