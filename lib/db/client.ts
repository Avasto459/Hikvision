import { createClient, type Client } from "@libsql/client";

declare global { var __hasiLibsqlClient: Client | undefined }

function createDb(): Client {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url || !token) {
    throw new Error("TURSO_DATABASE_URL ё TURSO_AUTH_TOKEN дар Vercel гузошта нашудаанд!");
  }

  return createClient({ url, authToken: token });
}

export const db = globalThis.__hasiLibsqlClient ?? createDb();
if (process.env.NODE_ENV !== "production") globalThis.__hasiLibsqlClient = db;

export const usingTurso = true;