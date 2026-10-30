import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

const useTurso = Boolean(process.env.TURSO_DATABASE_URL?.trim() && process.env.TURSO_AUTH_TOKEN?.trim());
if (!useTurso) await mkdir('data', { recursive: true });
const db = useTurso
  ? createClient({ url: process.env.TURSO_DATABASE_URL.trim(), authToken: process.env.TURSO_AUTH_TOKEN.trim() })
  : createClient({ url: 'file:data/hasi.db' });

if (useTurso && process.env.CONFIRM_REMOTE_DB_RESET !== 'YES') {
  console.error('ОТКАЗ: обнаружена удалённая база Turso. Для осознанного сброса задайте CONFIRM_REMOTE_DB_RESET=YES.');
  process.exit(2);
}

const now = new Date().toISOString();
const adminEmail = (process.env.HASI_ADMIN_EMAIL || 'najmiddinovavasto5@gmail.com').trim().toLowerCase();
const adminPassword = process.env.HASI_ADMIN_PASSWORD || 'admin123';
const adminHash = await bcrypt.hash(adminPassword, 12);

// Tables are cleared from child to parent to avoid FOREIGN KEY violations.
const clearStatements = [
  'DELETE FROM settlements',
  'DELETE FROM commissions',
  'DELETE FROM sales',
  'DELETE FROM order_items',
  'DELETE FROM customer_orders',
  'DELETE FROM orderItems',
  'DELETE FROM orders',
  'DELETE FROM contactMessages',
  'DELETE FROM activityLogs',
  'DELETE FROM stock_movements',
  'DELETE FROM offers_stock',
  'DELETE FROM dealer_limits',
  'DELETE FROM dealer_identity',
  'DELETE FROM warehouses WHERE isCentral=0',
  'DELETE FROM distributors',
  'DELETE FROM cartItems',
  'DELETE FROM userFavorites',
  'DELETE FROM passwordResets',
  'DELETE FROM passwordResetCodes',
  'DELETE FROM phonePasswordResetCodes',
  'DELETE FROM emailChangeCodes',
  'DELETE FROM pendingRegistrations',
];

try {
  await db.execute('PRAGMA foreign_keys=ON');
  // Ensure base tables exist before querying any rows.
  const tableCheck = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  if (!tableCheck.rows.length) {
    throw new Error('Таблицы базы данных ещё не созданы. Сначала запустите приложение один раз, затем повторите npm run db:reset.');
  }
  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE lower(email)=? LIMIT 1', args: [adminEmail] });
  let adminId = existing.rows[0]?.id ? String(existing.rows[0].id) : randomUUID();

  for (const sql of clearStatements) {
    try { await db.execute(sql); }
    catch (error) {
      // Optional tables may not exist in an older schema. Do not ignore FK or other data errors.
      const message = String(error?.message || error);
      if (!/no such table/i.test(message)) throw error;
    }
  }

  await db.execute({
    sql: `INSERT INTO users(id,firstName,lastName,email,phone,passwordHash,role,emailVerified,isBlocked,createdAt)
          VALUES(?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(email) DO UPDATE SET firstName=excluded.firstName,lastName=excluded.lastName,
          passwordHash=excluded.passwordHash,role='ADMIN',emailVerified=1,isBlocked=0`,
    args: [adminId, 'HASI', 'Admin', adminEmail, '', adminHash, 'ADMIN', 1, 0, now],
  });
  const admin = await db.execute({ sql: 'SELECT id FROM users WHERE lower(email)=? LIMIT 1', args: [adminEmail] });
  adminId = String(admin.rows[0].id);
  await db.execute({ sql: 'DELETE FROM users WHERE id<>?', args: [adminId] });

  // Keep only the central warehouse; clear stock links to ordinary dealers.
  await db.execute("DELETE FROM settings WHERE key LIKE 'reset.%'");
  await db.execute({ sql: 'INSERT OR REPLACE INTO settings(key,value,updatedAt) VALUES(?,?,?)', args: ['reset.lastRun', now, now] });

  const counts = {};
  for (const table of ['users','products','categories','orders','customer_orders','contactMessages','distributors','dealer_identity']) {
    const r = await db.execute(`SELECT COUNT(*) AS n FROM ${table}`);
    counts[table] = Number(r.rows[0]?.n || 0);
  }
  console.log('База очищена. Оставлен только администратор; товары и категории сохранены.');
  console.log(JSON.stringify({ database: useTurso ? 'Turso (remote)' : 'local data/hasi.db', adminEmail, counts }, null, 2));
} finally {
  await db.close();
}
