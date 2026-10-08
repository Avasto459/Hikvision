import { db } from "./client";

let init: Promise<void> | null = null;

const tables = [
`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', sourceUrl TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'published')`,
`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, shortDescription TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', sku TEXT NOT NULL DEFAULT '', brand TEXT NOT NULL DEFAULT '', images TEXT NOT NULL DEFAULT '[]', specifications TEXT NOT NULL DEFAULT '{}', price REAL NOT NULL DEFAULT 0, previousPrice REAL, image TEXT NOT NULL DEFAULT '', sourceUrl TEXT NOT NULL DEFAULT '', categoryId TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, rating REAL NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0, isPublished INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, FOREIGN KEY(categoryId) REFERENCES categories(id))`,
`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, firstName TEXT NOT NULL, lastName TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT NOT NULL DEFAULT '', passwordHash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'USER', avatar TEXT, emailVerified INTEGER NOT NULL DEFAULT 0, isBlocked INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS passwordResets (id TEXT PRIMARY KEY, userId TEXT NOT NULL, token TEXT UNIQUE NOT NULL, expiresAt TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS activityLogs (id TEXT PRIMARY KEY, actorId TEXT, action TEXT NOT NULL, message TEXT NOT NULL, createdAt TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS contactMessages (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'NEW', reply TEXT NOT NULL DEFAULT '', replyText TEXT NOT NULL DEFAULT '', isReplied INTEGER NOT NULL DEFAULT 0, repliedAt TEXT, userId TEXT, visitorToken TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, orderNumber TEXT UNIQUE, userId TEXT, firstName TEXT NOT NULL, lastName TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', comment TEXT NOT NULL DEFAULT '', total REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new', createdAt TEXT NOT NULL, FOREIGN KEY(userId) REFERENCES users(id))`,
`CREATE TABLE IF NOT EXISTS orderItems (id TEXT PRIMARY KEY, orderId TEXT NOT NULL, productId TEXT, sku TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', unitPrice REAL NOT NULL DEFAULT 0, quantity INTEGER NOT NULL, lineTotal REAL NOT NULL DEFAULT 0, FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS cartItems (userId TEXT NOT NULL, productId TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), updatedAt TEXT NOT NULL, PRIMARY KEY(userId, productId), FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS pendingRegistrations (email TEXT PRIMARY KEY, firstName TEXT NOT NULL, lastName TEXT NOT NULL, phone TEXT NOT NULL, passwordHash TEXT NOT NULL, codeHash TEXT NOT NULL, expiresAt TEXT NOT NULL, nextResendAt TEXT NOT NULL, dailyCount INTEGER NOT NULL DEFAULT 1, dailyWindow TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS passwordResetCodes (email TEXT PRIMARY KEY, userId TEXT NOT NULL, codeHash TEXT NOT NULL, expiresAt TEXT NOT NULL, nextResendAt TEXT NOT NULL, dailyCount INTEGER NOT NULL DEFAULT 1, dailyWindow TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS phonePasswordResetCodes (phone TEXT PRIMARY KEY, userId TEXT NOT NULL, codeHash TEXT NOT NULL, expiresAt TEXT NOT NULL, nextResendAt TEXT NOT NULL, dailyCount INTEGER NOT NULL DEFAULT 1, dailyWindow TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS emailChangeCodes (userId TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, codeHash TEXT NOT NULL, expiresAt TEXT NOT NULL, nextResendAt TEXT NOT NULL, dailyCount INTEGER NOT NULL DEFAULT 1, dailyWindow TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS userFavorites (userId TEXT NOT NULL, productId TEXT NOT NULL, createdAt TEXT NOT NULL, PRIMARY KEY(userId, productId), FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE)`
];

async function ensureColumn(table: string, column: string, definition: string) {
  const r = await db.execute(`PRAGMA table_info(${table})`);
  if (!r.rows.some(x => String(x.name) === column)) await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function initializeSchema(): Promise<void> {
  if (init) return init;
  init = (async () => {
    for (const sql of tables) await db.execute(sql);
    await ensureColumn("contactMessages", "email", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("contactMessages", "status", "TEXT NOT NULL DEFAULT 'NEW'");
    await ensureColumn("contactMessages", "replyText", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("contactMessages", "isReplied", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("contactMessages", "userId", "TEXT");
    await ensureColumn("contactMessages", "visitorToken", "TEXT NOT NULL DEFAULT ''");
    await ensureColumn("orders", "orderNumber", "TEXT");
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_idx ON orders(orderNumber)`);
    await db.execute(`UPDATE contactMessages SET replyText = reply WHERE replyText = '' AND reply <> ''`);
    await db.execute(`UPDATE contactMessages SET isReplied = 1 WHERE isReplied = 0 AND replyText <> ''`);
  })();
  try { await init; } catch (e) { init = null; throw e; }
}
