import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { db } from "@/lib/db/db";
import { initializeSchema } from "@/lib/db/schema";
import { StoreError } from "@/lib/db";

/** Онлайн-чат: переписка (thread) = посетитель ↔ администратор, сообщения хранятся в БД. */

export type ChatMessage = { id: string; sender: "visitor" | "admin"; body: string; createdAt: string };
export type ChatThreadSummary = {
  id: string; name: string; phone: string; adminUnread: number; lastMessageAt: string; createdAt: string;
  lastBody: string; lastSender: "visitor" | "admin" | ""; isRegistered: boolean;
};

const MAX_BODY = 2000;
const now = () => new Date().toISOString();
const s = (v: unknown) => (v == null ? "" : String(v));

/* Простейший лимит на отправку (в памяти процесса): не более 12 сообщений в минуту с одного ключа. */
const hits = new Map<string, number[]>();
export function chatRateLimit(key: string, max = 12, windowMs = 60_000) {
  const t = Date.now();
  const list = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  if (list.length >= max) throw new StoreError("Слишком много сообщений. Подождите минуту.", 429);
  list.push(t); hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

const mapMessage = (r: Record<string, unknown>): ChatMessage => ({ id: s(r.id), sender: r.sender === "admin" ? "admin" : "visitor", body: s(r.body), createdAt: s(r.createdAt) });

async function assertVisitor(threadId: string, token: string) {
  await initializeSchema();
  const r = (await db.execute({ sql: "SELECT id, visitorToken FROM chat_threads WHERE id=?", args: [threadId] })).rows[0];
  if (!r || !sameToken(s(r.visitorToken), token)) throw new StoreError("Чат не найден.", 404);
}

/** Сообщение посетителя; без threadId создаётся новая переписка. */
export async function postVisitorMessage(p: { threadId?: string; token?: string; name?: string; phone?: string; userId?: string | null; body: string }) {
  await initializeSchema();
  const body = p.body.trim();
  if (!body) throw new StoreError("Введите сообщение.", 400);
  if (body.length > MAX_BODY) throw new StoreError(`Сообщение не длиннее ${MAX_BODY} символов.`, 400);
  const ts = now();
  const msgId = randomUUID();

  if (p.threadId && p.token) {
    await assertVisitor(p.threadId, p.token);
    await db.batch([
      { sql: "INSERT INTO chat_messages(id, threadId, sender, body, createdAt) VALUES(?,?, 'visitor', ?, ?)", args: [msgId, p.threadId, body, ts] },
      { sql: "UPDATE chat_threads SET adminUnread=adminUnread+1, lastMessageAt=?, name=CASE WHEN ?<>'' THEN ? ELSE name END, phone=CASE WHEN ?<>'' THEN ? ELSE phone END WHERE id=?", args: [ts, s(p.name).trim(), s(p.name).trim().slice(0, 200), s(p.phone).trim(), s(p.phone).trim().slice(0, 100), p.threadId] },
    ], "write");
    return { threadId: p.threadId, token: p.token, messageId: msgId, createdAt: ts };
  }

  const name = s(p.name).trim().slice(0, 200);
  const phone = s(p.phone).trim().slice(0, 100);
  if (!p.userId && (!name || !phone)) throw new StoreError("Укажите имя и телефон, чтобы мы могли ответить.", 400);
  const threadId = randomUUID();
  const token = randomBytes(24).toString("hex");
  await db.batch([
    { sql: "INSERT INTO chat_threads(id, visitorToken, userId, name, phone, adminUnread, visitorUnread, lastMessageAt, createdAt) VALUES(?,?,?,?,?,1,0,?,?)", args: [threadId, token, p.userId || null, name || "Пользователь HASI", phone, ts, ts] },
    { sql: "INSERT INTO chat_messages(id, threadId, sender, body, createdAt) VALUES(?,?, 'visitor', ?, ?)", args: [msgId, threadId, body, ts] },
  ], "write");
  return { threadId, token, messageId: msgId, createdAt: ts };
}

/** Переписка для посетителя; помечает ответы администратора прочитанными, если read=true. */
export async function getVisitorThread(threadId: string, token: string, opts: { read?: boolean } = {}) {
  await assertVisitor(threadId, token);
  const rows = (await db.execute({ sql: "SELECT * FROM chat_messages WHERE threadId=? ORDER BY createdAt ASC LIMIT 500", args: [threadId] })).rows;
  const unread = Number((await db.execute({ sql: "SELECT visitorUnread FROM chat_threads WHERE id=?", args: [threadId] })).rows[0]?.visitorUnread ?? 0);
  if (opts.read && unread) await db.execute({ sql: "UPDATE chat_threads SET visitorUnread=0 WHERE id=?", args: [threadId] });
  return { messages: rows.map(mapMessage), unread: opts.read ? 0 : unread };
}

export async function listAdminThreads(): Promise<ChatThreadSummary[]> {
  await initializeSchema();
  const r = await db.execute(`SELECT t.*, 
      (SELECT body FROM chat_messages m WHERE m.threadId=t.id ORDER BY m.createdAt DESC LIMIT 1) AS lastBody,
      (SELECT sender FROM chat_messages m WHERE m.threadId=t.id ORDER BY m.createdAt DESC LIMIT 1) AS lastSender
    FROM chat_threads t ORDER BY t.lastMessageAt DESC LIMIT 300`);
  return r.rows.map((x) => ({
    id: s(x.id), name: s(x.name), phone: s(x.phone), adminUnread: Number(x.adminUnread ?? 0),
    lastMessageAt: s(x.lastMessageAt), createdAt: s(x.createdAt), lastBody: s(x.lastBody),
    lastSender: x.lastSender === "admin" ? "admin" : x.lastSender === "visitor" ? "visitor" : "", isRegistered: Boolean(x.userId),
  }));
}

export async function getAdminThread(threadId: string, markRead = true) {
  await initializeSchema();
  const t = (await db.execute({ sql: "SELECT * FROM chat_threads WHERE id=?", args: [threadId] })).rows[0];
  if (!t) throw new StoreError("Переписка не найдена.", 404);
  if (markRead && Number(t.adminUnread)) await db.execute({ sql: "UPDATE chat_threads SET adminUnread=0 WHERE id=?", args: [threadId] });
  const rows = (await db.execute({ sql: "SELECT * FROM chat_messages WHERE threadId=? ORDER BY createdAt ASC LIMIT 1000", args: [threadId] })).rows;
  return { thread: { id: s(t.id), name: s(t.name), phone: s(t.phone), isRegistered: Boolean(t.userId) }, messages: rows.map(mapMessage) };
}

export async function postAdminReply(threadId: string, body: string) {
  await initializeSchema();
  const text = body.trim();
  if (!text) throw new StoreError("Введите текст ответа.", 400);
  if (text.length > 5000) throw new StoreError("Ответ не длиннее 5000 символов.", 400);
  const ts = now();
  const id = randomUUID();
  const exists = (await db.execute({ sql: "SELECT 1 FROM chat_threads WHERE id=?", args: [threadId] })).rows.length;
  if (!exists) throw new StoreError("Переписка не найдена.", 404);
  await db.batch([
    { sql: "INSERT INTO chat_messages(id, threadId, sender, body, createdAt) VALUES(?,?, 'admin', ?, ?)", args: [id, threadId, text, ts] },
    { sql: "UPDATE chat_threads SET visitorUnread=visitorUnread+1, adminUnread=0, lastMessageAt=? WHERE id=?", args: [ts, threadId] },
  ], "write");
  return { id, sender: "admin" as const, body: text, createdAt: ts };
}

export async function deleteThread(threadId: string) {
  await initializeSchema();
  await db.execute({ sql: "DELETE FROM chat_messages WHERE threadId=?", args: [threadId] });
  const r = await db.execute({ sql: "DELETE FROM chat_threads WHERE id=?", args: [threadId] });
  if (!r.rowsAffected) throw new StoreError("Переписка не найдена.", 404);
}

export async function countAdminUnread() {
  await initializeSchema();
  return Number((await db.execute("SELECT COALESCE(SUM(adminUnread),0) AS c FROM chat_threads")).rows[0]?.c ?? 0);
}
