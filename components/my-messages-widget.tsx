"use client";

import { MessageCircle, Send, X, LoaderCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { whatsappLink } from "@/lib/site-contacts";

/** Устаревшие обращения из формы /contact (одно сообщение + один ответ) — показываем в той же ленте. */
type LegacyMessage = {
  id: string; message: string; replyText: string; isReplied: boolean; repliedAt: string | null; createdAt: string;
};
type VisitorItem = { id: string; token: string };
type ChatMsg = { id: string; sender: "visitor" | "admin"; body: string; createdAt: string };
type Stored = { threadId: string; token: string };

const ITEMS_KEY = "hasi-contact-messages";
const THREAD_KEY = "hasi-chat-thread";
const SEEN_KEY = "hasi-chat-seen-count";
const GUEST_NAME_KEY = "hasi-chat-guest-name";
const GUEST_PHONE_KEY = "hasi-chat-guest-phone";
const SENT_EVENT = "hasi:contact-sent";
const POLL_MS = 3000;
const WA_TEXT = "Здравствуйте! У меня вопрос по заказу на HASI Market";

function readJson<T>(key: string, fallback: T): T {
  try { return (JSON.parse(localStorage.getItem(key) || "null") ?? fallback) as T; } catch { return fallback; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage недоступен */ }
}

/** Вызывается формой /contact: запоминает обращение, чтобы ответ появился в чате. */
export function rememberContactMessage(id: string, token: string) {
  const items = readJson<VisitorItem[]>(ITEMS_KEY, []).filter((item) => item.id !== id);
  writeJson(ITEMS_KEY, [{ id, token }, ...items].slice(0, 50));
  window.dispatchEvent(new Event(SENT_EVENT));
}

/** Плавающая кнопка поддержки: онлайн-чат с администратором + быстрый переход в WhatsApp. */
export function MyMessagesWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Stored | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [legacy, setLegacy] = useState<LegacyMessage[]>([]);
  const [seen, setSeen] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const openRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /** Единая лента: старые обращения + переписка чата, по времени. */
  const feed = useMemo(() => {
    const items: ChatMsg[] = [];
    for (const m of legacy) {
      items.push({ id: `l-${m.id}`, sender: "visitor", body: m.message, createdAt: m.createdAt });
      if (m.isReplied && m.replyText) items.push({ id: `lr-${m.id}`, sender: "admin", body: m.replyText, createdAt: m.repliedAt || m.createdAt });
    }
    items.push(...chat);
    return items.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [legacy, chat]);

  const adminCount = feed.filter((m) => m.sender === "admin").length;
  const unread = open ? 0 : Math.max(0, adminCount - seen);

  const refresh = useCallback(async () => {
    const stored = readJson<Stored | null>(THREAD_KEY, null);
    if (stored) {
      try {
        const q = new URLSearchParams({ threadId: stored.threadId, token: stored.token });
        if (openRef.current) q.set("read", "1");
        const res = await fetch(`/api/chat?${q}`, { cache: "no-store" });
        if (res.status === 404) { localStorage.removeItem(THREAD_KEY); setThread(null); setChat([]); }
        else if (res.ok) setChat(((await res.json()) as { messages: ChatMsg[] }).messages);
      } catch { /* повтор при следующем опросе */ }
    }
    const items = readJson<VisitorItem[]>(ITEMS_KEY, []);
    const auth = localStorage.getItem("hasi-token");
    if (items.length || auth) {
      try {
        const res = await fetch("/api/messages", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify({ items }) });
        if (res.ok) setLegacy(((await res.json()) as { messages?: LegacyMessage[] }).messages || []);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    setThread(readJson<Stored | null>(THREAD_KEY, null));
    setSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    setIsLoggedIn(Boolean(localStorage.getItem("hasi-token")));
    setName(localStorage.getItem(GUEST_NAME_KEY) || "");
    setPhone(localStorage.getItem(GUEST_PHONE_KEY) || "");
    const loadProfile = async () => {
      const token = localStorage.getItem("hasi-token");
      if (!token) return;
      try {
        const res = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!res.ok) return;
        const { user } = (await res.json()) as { user?: { firstName?: string; lastName?: string; name?: string; phone?: string } };
        if (user) {
          setName([user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || "Пользователь HASI");
          setPhone(user.phone || "");
        }
      } catch { /* поля гостя остаются доступными */ }
    };
    void loadProfile(); void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    const onSent = () => { void refresh(); };
    const onAuth = () => { setIsLoggedIn(Boolean(localStorage.getItem("hasi-token"))); void loadProfile(); void refresh(); };
    window.addEventListener(SENT_EVENT, onSent);
    window.addEventListener("hasi-auth-changed", onAuth);
    return () => { window.clearInterval(timer); window.removeEventListener(SENT_EVENT, onSent); window.removeEventListener("hasi-auth-changed", onAuth); };
  }, [refresh]);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      setSeen(adminCount); try { localStorage.setItem(SEEN_KEY, String(adminCount)); } catch { /* ignore */ }
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }, [open, feed.length, adminCount]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    const body = text.trim();
    if (!body || sending) return;
    if (!thread && !isLoggedIn && (!name.trim() || !phone.trim())) { setError("Укажите имя и телефон, чтобы мы могли ответить."); return; }
    setSending(true);
    try {
      const token = localStorage.getItem("hasi-token");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ threadId: thread?.threadId, token: thread?.token, name: name.trim(), phone: phone.trim(), text: body }),
      });
      const data = (await res.json()) as { error?: string; threadId?: string; token?: string };
      if (!res.ok || !data.threadId || !data.token) throw new Error(data.error || "Не удалось отправить сообщение.");
      const stored = { threadId: data.threadId, token: data.token };
      writeJson(THREAD_KEY, stored); setThread(stored); setText("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка отправки. Попробуйте ещё раз.");
    } finally { setSending(false); }
  }

  // Админка — отдельный изолированный макет со своим разделом «Сообщения».
  if (pathname.startsWith("/admin")) return null;

  const needsContact = !thread && !isLoggedIn;
  const label = unread > 0 ? `Открыть онлайн-чат, новых ответов: ${unread}` : "Открыть онлайн-чат";

  return (
    <div className="fixed bottom-20 right-3 z-[90] sm:bottom-6 sm:right-6">
      {open ? (
        <section aria-label="Онлайн-чат HASI" className="mb-3 flex max-h-[min(80dvh,650px)] w-[calc(100vw-1.5rem)] max-w-[390px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <header className="flex items-center justify-between bg-gradient-to-r from-violet-700 to-indigo-700 px-4 py-3 text-white">
            <div><h2 className="text-sm font-bold">Онлайн-чат HASI Market</h2><p className="text-xs text-violet-100">Отвечаем в рабочее время</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть чат" className="rounded-full p-2 hover:bg-white/20"><X className="h-4 w-4" /></button>
          </header>

          <a href={whatsappLink(WA_TEXT)} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 0 0 5.6 1.4C18.6 23.7 24 18.4 24 11.8c0-3.2-1.2-6.1-3.5-8.3ZM12 21.7a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.800 1 1-3.700-.2-.4a9.800 9.800 0 0 1-1.500-5.200c0-5.400 4.400-9.800 9.900-9.800 2.600 0 5.100 1 6.900 2.900a9.700 9.700 0 0 1 2.900 6.900c0 5.400-4.500 9.900-9.800 9.900Zm5.400-7.400c-.3-.1-1.800-.9-2-1-.3-.1-.5-.1-.7.100l-1 1.200c-.2.200-.4.200-.6.100a8 8 0 0 1-4-3.500c-.3-.5.300-.5.900-1.600.1-.2 0-.4 0-.5l-.9-2.100c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400-.3.300-1 1-1 2.500s1.100 2.900 1.200 3.100c.2.200 2.100 3.300 5.200 4.600 1.900.8 2.700.9 3.600.7.600-.1 1.800-.7 2-1.500.3-.7.300-1.300.2-1.500-.1-.1-.3-.2-.6-.4Z"/></svg>
            Написать в WhatsApp
          </a>

          <div className="min-h-32 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950/40">
            {!feed.length ? <p className="rounded-2xl bg-white p-3 text-sm text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">Здравствуйте! Напишите вопрос о товаре, заказе или доставке — администратор ответит прямо здесь.</p> : null}
            {feed.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "visitor" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender === "visitor" ? "rounded-br-sm bg-violet-700 text-white" : "rounded-bl-sm bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"}`}>
                  {m.sender === "admin" ? <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">HASI Market</p> : null}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <time className="mt-1 block text-[10px] opacity-60">{new Date(m.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={(e) => void submit(e)} className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
            {needsContact ? (
              <div className="grid grid-cols-2 gap-2">
                <input value={name} onChange={(e) => { setName(e.target.value); try { localStorage.setItem(GUEST_NAME_KEY, e.target.value); } catch { /* ignore */ } }} placeholder="Ваше имя" aria-label="Ваше имя" maxLength={200} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <input value={phone} onChange={(e) => { setPhone(e.target.value); try { localStorage.setItem(GUEST_PHONE_KEY, e.target.value); } catch { /* ignore */ } }} placeholder="Телефон" aria-label="Телефон" inputMode="tel" maxLength={100} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Напишите сообщение…" aria-label="Сообщение" rows={2} maxLength={2000}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
                className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <button disabled={sending || !text.trim()} type="submit" aria-label="Отправить сообщение" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-white hover:bg-violet-600 disabled:opacity-60">
                {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
          </form>
        </section>
      ) : null}

      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={label} aria-expanded={open}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-violet-700 text-white shadow-lg ring-4 ring-violet-700/15 transition hover:scale-105 hover:bg-violet-600 active:scale-95">
          <MessageCircle className="h-6 w-6" />
          {unread > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold">{unread}</span> : null}
        </button>
      </div>
    </div>
  );
}
