import { createClient, type Client } from "@libsql/client"
import { existsSync, copyFileSync } from "node:fs"
import { join } from "node:path"

declare global {
  var __hasiLibsqlClient: Client | undefined
}

// Абсолютный путь к закоммиченной базе: в serverless-бандле Vercel cwd может
// отличаться, поэтому опираемся на process.cwd() (корень проекта, куда
// outputFileTracingIncludes упаковывает ./data/hasi.db).
function bundledDbPath(): string {
  return join(process.cwd(), "data", "hasi.db")
}

function tmpDbPath(): string {
  return "/tmp/hasi.db"
}

// ФС Vercel только для чтения — SQLite нужен writable-файл, поэтому копируем
// закоммиченную базу в /tmp один раз и открываем копию.
function writableFileDb(): Client {
  const src = bundledDbPath()
  // Локально (не Vercel) работаем напрямую с data/hasi.db проекта. Копия в /tmp нужна только
  // на Vercel (read-only ФС); иначе устаревший /tmp/hasi.db от прошлого запуска подменяет базу.
  if (!isVercel() && existsSync(src)) return createClient({ url: `file:${src}` })
  const dst = tmpDbPath()
  if (existsSync(dst)) return createClient({ url: `file:${dst}` })
  try {
    if (existsSync(src)) copyFileSync(src, dst)
  } catch {
    // Если копия не удалась (например, локально без прав), пробуем оригинал.
  }
  if (existsSync(dst)) return createClient({ url: `file:${dst}` })
  if (existsSync(src)) return createClient({ url: `file:${src}` })
  throw new Error(`База данных не найдена: ${src}`)
}

function isVercel(): boolean {
  return process.env.VERCEL === "1"
}

export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV !== "production" && !isVercel()
}

function isLocalDbAllowed(): boolean {
  // USE_LOCAL_DB разрешён в любой среде, включая Vercel — так committed
  // data/hasi.db (закоммичен в git) читается и на продакшене.
  // Без флага на Vercel тоже читаем bundled-файл (см. createDb).
  return process.env.USE_LOCAL_DB === "true" || isVercel()
}

function createDb(): Client {
  const url = process.env.TURSO_DATABASE_URL?.trim()
  const token = process.env.TURSO_AUTH_TOKEN?.trim()
  const forceLocal = process.env.USE_LOCAL_DB === "true"
  const isProd = process.env.NODE_ENV === "production" || isVercel()

  // Локальная разработка (localhost) — всегда файловый SQLite data/hasi.db.
  if (!isProd) return writableFileDb()

  // Явный локальный режим — файловый SQLite даже на продакшене.
  if (forceLocal) return writableFileDb()

  // Production (Vercel / NODE_ENV=production) — облачный Turso (libsql),
  // если заданы TURSO_DATABASE_URL и TURSO_AUTH_TOKEN.
  if (url && token) {
    return createClient({ url, authToken: token })
  }

  // Production без Turso — закоммиченный data/hasi.db (копия в /tmp).
  return writableFileDb()
}

export const db = globalThis.__hasiLibsqlClient ?? createDb()

if (process.env.NODE_ENV !== "production") {
  globalThis.__hasiLibsqlClient = db
}

export const usingTurso = Boolean(
  process.env.TURSO_DATABASE_URL?.trim() && process.env.TURSO_AUTH_TOKEN?.trim()
) && process.env.USE_LOCAL_DB !== "true" && !isLocalDevelopment()

// Честный режим базы (совпадает с createDb выше):
// Turso — только Production с TURSO-переменными без USE_LOCAL_DB;
// file — локальная разработка и Vercel с закоммиченным data/hasi.db (копия в /tmp);
// memory — только крайний случай без файла базы.
export const databaseMode: "file" | "turso" | "memory" =
  usingTurso
    ? "turso"
    : isLocalDbAllowed() || isLocalDevelopment()
      ? "file"
      : "memory";
