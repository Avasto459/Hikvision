"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle, MessageCircle, Send, Trash2 } from "lucide-react";

type Thread = { id: string; name: string; phone: string; adminUnread: number; lastMessageAt: string; lastBody: string; lastSender: "visitor" | "admin" | ""; isRegistered: boolean };
type Msg = { id: string; sender: "visitor" | "admin"; body: string; createdAt: string };
type Opened = { thread: { id: string; name: string; phone: string; isRegistered: boolean }; messages: Msg[] };

const LIST_POLL_MS = 4000;
const THREAD_POLL_MS = 3000;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("hasi-token");
  const res = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
  return data;
}
const digits = (v: string) => v.replace(/\D/g, "");
const fmt = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Раздел «Сообщения / Чат»: список переписок, история, ответ. Обновляется опросом (почти в реальном времени). */
export function AdminChat() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const loadList = useCallback(async () => {
    try {
      const d = await api<{ threads: Thread[] }>("/api/admin/chat");
      setThreads(d.threads); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки."); }
    finally { setLoading(false); }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try { setOpened(await api<Opened>(`/api/admin/chat/${id}`)); } catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки."); }
  }, []);

  useEffect(() => {
    void loadList();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void loadList(); }, LIST_POLL_MS);
    return () => window.clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!activeId) { setOpened(null); return; }
    lastCount.current = 0;
    void loadThread(activeId);
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void loadThread(activeId); }, THREAD_POLL_MS);
    return () => window.clearInterval(t);
  }, [activeId, loadThread]);

  useEffect(() => {
    const n = opened?.messages.length ?? 0;
    if (n !== lastCount.current) { lastCount.current = n; bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }
  }, [opened]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!activeId || !text.trim() || sending) return;
    setSending(true);
    try {
      await api(`/api/admin/chat/${activeId}`, { method: "POST", body: JSON.stringify({ text }) });
      setText(""); await loadThread(activeId); await loadList();
    } catch (x) { setError(x instanceof Error ? x.message : "Не удалось отправить."); }
    finally { setSending(false); }
  }

  async function removeThread() {
    if (!activeId) return;
    try {
      await api(`/api/admin/chat/${activeId}`, { method: "DELETE" });
      setActiveId(null); setConfirmDelete(false); await loadList();
    } catch (x) { setError(x instanceof Error ? x.message : "Не удалось удалить."); }
  }

  const unreadTotal = threads.reduce((n, t) => n + t.adminUnread, 0);
  const wa = opened && digits(opened.thread.phone).length >= 9 ? digits(opened.thread.phone) : "";

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      <div className="grid h-[calc(100dvh-12rem)] min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[320px_1fr]">
        {/* Список переписок */}
        <aside className={`${activeId ? "hidden md:flex" : "flex"} min-h-0 flex-col border-slate-200 dark:border-slate-800 md:border-r`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="font-bold">Чаты</h2>
            {unreadTotal ? <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{unreadTotal} новых</span> : null}
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {loading ? <li className="p-6 text-center text-sm text-slate-500">Загрузка…</li> : null}
            {!loading && !threads.length ? <li className="p-6 text-center text-sm text-slate-500">Сообщений пока нет.</li> : null}
            {threads.map((t) => (
              <li key={t.id}>
                <button onClick={() => { setActiveId(t.id); setConfirmDelete(false); }} className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 ${activeId === t.id ? "bg-violet-50 dark:bg-violet-500/10" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{t.name || "Гость"}{t.isRegistered ? <span className="ml-1 text-[10px] font-bold text-emerald-600">аккаунт</span> : null}</span>
                    <time className="shrink-0 text-[10px] text-slate-400">{fmt(t.lastMessageAt)}</time>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-500">{t.lastSender === "admin" ? "Вы: " : ""}{t.lastBody}</span>
                    {t.adminUnread ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">{t.adminUnread}</span> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Переписка */}
        <section className={`${activeId ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
          {!activeId || !opened ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-slate-500">
              {activeId ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <MessageCircle className="h-10 w-10 opacity-40" />}
              <p className="text-sm">{activeId ? "Загрузка переписки…" : "Выберите чат слева, чтобы прочитать и ответить."}</p>
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-800 sm:px-4">
                <button onClick={() => setActiveId(null)} aria-label="Назад к списку" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{opened.thread.name || "Гость"}</p>
                  <p className="truncate text-xs text-slate-500">{opened.thread.phone ? <a href={`tel:${opened.thread.phone}`} className="text-violet-700 dark:text-violet-300">{opened.thread.phone}</a> : "телефон не указан"}</p>
                </div>
                {wa ? <a href={`https://wa.me/${wa}?text=${encodeURIComponent("Здравствуйте! Это HASI Market — отвечаем на ваше сообщение.")}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">WhatsApp</a> : null}
                {confirmDelete ? (
                  <span className="flex items-center gap-1"><button onClick={() => void removeThread()} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">Удалить?</button><button onClick={() => setConfirmDelete(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold dark:bg-slate-800">Нет</button></span>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} aria-label="Удалить переписку" className="rounded-xl bg-rose-100 p-2 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200"><Trash2 className="h-4 w-4" /></button>
                )}
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950/40 sm:p-4">
                {opened.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender === "admin" ? "rounded-br-sm bg-violet-700 text-white" : "rounded-bl-sm bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"}`}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <time className="mt-1 block text-[10px] opacity-60">{fmt(m.createdAt)}</time>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={(e) => void send(e)} className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={5000} placeholder="Ответ покупателю… (Enter — отправить, Shift+Enter — новая строка)"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <button disabled={sending || !text.trim()} aria-label="Отправить ответ" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-white hover:bg-violet-600 disabled:opacity-50">
                  {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
