// Diagnostic: verify image URLs stored in Turso after sync.
import { createClient } from '@libsql/client';

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const r = await db.execute(`SELECT COUNT(*) AS n,
  SUM(CASE WHEN image LIKE 'https://hasi.tj/wp-content/uploads/%' THEN 1 ELSE 0 END) AS good,
  SUM(CASE WHEN image LIKE '/%' THEN 1 ELSE 0 END) AS relative
  FROM products WHERE isPublished=1`);
console.log('total:', r.rows[0].n);
console.log('with https://hasi.tj/wp-content/uploads/:', r.rows[0].good);
console.log('with relative /... path (must be 0):', r.rows[0].relative);

const sample = await db.execute('SELECT slug, image FROM products ORDER BY slug LIMIT 3');
for (const row of sample.rows) {
  console.log('-', String(row.slug), '=>', String(row.image).slice(0, 100));
}
await db.close();
