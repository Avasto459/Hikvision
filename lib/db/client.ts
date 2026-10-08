import { createClient, type Client } from "@libsql/client";

declare global {
  var __hasiLibsqlClient: Client | undefined;
}

function createDb(): Client {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();

  // Если переменные Turso заданы (например, на Vercel или в .env.local)
  if (url && token) {
    return createClient({ url, authToken: token });
  }

  // Если переменные не заданы (локальный запуск без .env.local)
  return createClient({ url: "file:data/hasi.db" });
}

export const db = globalThis.__hasiLibsqlClient ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalThis.__hasiLibsqlClient = db;
}

export const usingTurso = Boolean(
  process.env.TURSO_DATABASE_URL?.trim() && process.env.TURSO_AUTH_TOKEN?.trim()
);