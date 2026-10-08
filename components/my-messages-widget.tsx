"use client";

import { MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type PublicMessage = {
  id: string;
  message: string;
  status: "NEW" | "READ" | "ANSWERED";
  replyText: string;
  isReplied: boolean;
  repliedAt: string | null;
  createdAt: string;
};

const ITEMS_KEY = "hasi-contact-messages";
const SEEN_KEY = "hasi-contact-seen";
const SENT_EVENT = "hasi:contact-sent";
const POLL_MS = 15_000;

function readJson<T>(key: string, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || "null");
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Вызывается формой «Контакты» после успешной отправки: запоминает токен и будит виджет. */
export function rememberContactMessage(id: string, token: string) {
  const items = readJson<Array<{ id: string; token: string }>>(ITEMS_KEY, []).filter((item) => item.id !== id);
  localStorage.setItem(ITEMS_KEY, JSON.stringify([{ id, token }, ...items].slice(0, 50)));
  window.dispatchEvent(new Event(SENT_EVENT));
}

/**
 * «Мои обращения»: плавающая кнопка с историей переписки (сообщение клиента → ответ админа).
 * Ответы подтягиваются периодическим опросом POST /api/messages (каждые 15 с, пока вкладка видима).
 */
export function MyMessagesWidget() {
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  const markSeen = useCallback((list: PublicMessage[]) => {
    const next = readJson<Record<string, string>>(SEEN_KEY, {});
    for (const item of list) if (item.isReplied && item.repliedAt) next[item.id] = item.repliedAt;
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    setSeen(next);
  }, []);

  const refresh = useCallback(async () => {
    const items = readJson<Array<{ id: string; token: string }>>(ITEMS_KEY, []);
    const auth = localStorage.getItem("hasi-token");
    if (!items.length && !auth) return;
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
        body: JSON.stringify({ items }),
      });
      if (!response.ok) return; // временная ошибка или устаревшая сессия — попробуем при следующем опросе
      const data = await response.json() as { messages?: PublicMessage[] };
      const list = data.messages || [];
      setMessages(list);
      if (openRef.current) markSeen(list);
    } catch {
      // сеть недоступна — тихо ждём следующий опрос
    }
  }, [markSeen]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    setSeen(readJson<Record<string, string>>(SEEN_KEY, {}));
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    const onSent = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener(SENT_EVENT, onSent);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(SENT_EVENT, onSent);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  if (!messages.length) return null;
  const unread = messages.filter((item) => item.isReplied && item.repliedAt && seen[item.id] !== item.repliedAt).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) markSeen(messages);
  }

  return (
    <div className="fixed bottom-20 right-4 z-[60] sm:bottom-6 sm:right-6">
      {open ? (
        <section aria-label="Мои обращения" className="mb-3 flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <header className="flex items-center justify-between bg-violet-700 px-4 py-3 text-white">
            <h2 className="text-sm font-bold">Мои обращения</h2>
            <button type="button" onClick={toggle} aria-label="Закрыть" className="rounded-full p-1 hover:bg-white/20"><X className="h-4 w-4" /></button>
          </header>
          <div className="space-y-4 overflow-y-auto p-4">
            {messages.map((item) => (
              <article key={item.id} className="space-y-2">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-violet-100 px-3 py-2 text-sm text-violet-950 dark:bg-violet-900/40 dark:text-violet-100">
                  <p className="whitespace-pre-wrap break-words">{item.message}</p>
                  <time className="mt-1 block text-[10px] opacity-60">{new Date(item.createdAt).toLocaleString("ru-RU")}</time>
                </div>
                {item.isReplied && item.replyText ? (
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ответ HASI.TJ</div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">{item.replyText}</p>
                    {item.repliedAt ? <time className="mt-1 block text-[10px] opacity-60">{new Date(item.repliedAt).toLocaleString("ru-RU")}</time> : null}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ждём ответа магазина — он появится здесь автоматически.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <button type="button" onClick={toggle} aria-label={`Мои обращения${unread ? `, новых ответов: ${unread}` : ""}`} aria-expanded={open} className="relative ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-700 text-white shadow-lg transition hover:bg-violet-600 active:scale-95">
        <MessageCircle className="h-6 w-6" />
        {unread > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold">{unread}</span> : null}
      </button>
    </div>
  );
}
