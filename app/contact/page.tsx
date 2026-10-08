"use client";

import { FormEvent, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { rememberContactMessage } from "@/components/my-messages-widget";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(localStorage.getItem("hasi-token") ? { Authorization: `Bearer ${localStorage.getItem("hasi-token")}` } : {}) },
        body: JSON.stringify(form),
      });
      const result = await response.json() as { message?: string; error?: string; id?: string; visitorToken?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось отправить сообщение.");
      if (result.id && result.visitorToken) rememberContactMessage(result.id, result.visitorToken);
      setStatus(`${result.message || "Сообщение сохранено."} Ответ магазина появится в окне «Мои обращения» на этой странице.`);
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить сообщение.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Контакты</p>
            <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white">Подбор оборудования HASI.TJ</h1>
            <p className="mt-5 text-slate-600 dark:text-slate-300">Оставьте телефон и вопрос по камерам или оборудованию. Сообщение сохранится в системе для обработки магазином.</p>
            <div className="mt-8 space-y-4 text-slate-600 dark:text-slate-300">
              <p><span className="font-semibold text-slate-900 dark:text-white">Телефон:</span> (992) 93-333-51-11</p>
              <p><span className="font-semibold text-slate-900 dark:text-white">Адрес:</span> Таджикистан, Худжанд</p>
            </div>
          </div>

          <form onSubmit={submit} className="rounded-[28px] bg-slate-50 p-6 dark:bg-slate-800/80">
            <div className="text-lg font-bold text-slate-900 dark:text-white">Написать нам</div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">Имя<input required maxLength={200} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${fieldClass} mt-2`} /></label>
              <label className="block text-sm font-medium">Телефон<input required maxLength={100} type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={`${fieldClass} mt-2`} /></label>
              <label className="block text-sm font-medium">Email (необязательно — для ответа по почте)<input type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={`${fieldClass} mt-2`} /></label>
              <label className="block text-sm font-medium">Сообщение<textarea required maxLength={2000} rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className={`${fieldClass} mt-2`} /></label>
              {status ? <p role="status" className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-800">{status}</p> : null}
              {error ? <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm text-rose-800">{error}</p> : null}
              <button type="submit" disabled={sending} className="w-full rounded-2xl bg-violet-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-600 disabled:opacity-60">{sending ? "Отправляем…" : "Отправить сообщение"}</button>
            </div>
          </form>
        </div>
      </section>
    </SiteShell>
  );
}
