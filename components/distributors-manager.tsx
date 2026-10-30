"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, KeyRound, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";

export type Distributor = {
  id: string; name: string; email: string; phone: string; status: string;
  warehouses: number; products?: number; createdAt?: string;
};

const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-60 sm:text-sm";
const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("hasi-token");
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
  return data;
}
const errText = (e: unknown) => (e instanceof Error ? e.message : "Ошибка.");

/** Полное управление дистрибьюторами: создать, изменить (название/email/телефон/статус/пароль), удалить. */
export function DistributorsManager({ say }: { say?: (ok: boolean, text: string) => void }) {
  const [rows, setRows] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [localToast, setLocalToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", email: "", phone: "", password: "", status: "active" });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");

  const notify = useCallback((ok: boolean, text: string) => { if (say) say(ok, text); else setLocalToast({ ok, text }); }, [say]);

  const load = useCallback(async () => {
    try {
      setRows((await api<{ distributors: Distributor[] }>("/api/admin/hasi/distributors")).distributors);
    } catch (e) { notify(false, errText(e)); }
    finally { setLoading(false); }
  }, [notify]);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy("create");
    try {
      await api("/api/admin/hasi/distributors", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", email: "", phone: "", password: "" });
      notify(true, "Дистрибьютор и его склад созданы.");
      await load();
    } catch (x) { notify(false, errText(x)); }
    finally { setBusy(""); }
  }

  function startEdit(d: Distributor) {
    setConfirmId(null); setEditId(d.id);
    setEdit({ name: d.name, email: d.email, phone: d.phone, password: "", status: d.status === "blocked" ? "blocked" : "active" });
  }

  async function save(e: FormEvent, id: string) {
    e.preventDefault();
    setBusy(`save-${id}`);
    try {
      await api(`/api/admin/hasi/distributors/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: edit.name, email: edit.email, phone: edit.phone, status: edit.status, ...(edit.password ? { password: edit.password } : {}) }),
      });
      setEditId(null); notify(true, "Изменения сохранены."); await load();
    } catch (x) { notify(false, errText(x)); }
    finally { setBusy(""); }
  }

  async function remove(id: string) {
    setBusy(`del-${id}`);
    try {
      await api(`/api/admin/hasi/distributors/${id}`, { method: "DELETE" });
      setConfirmId(null); notify(true, "Дистрибьютор удалён."); await load();
    } catch (x) { notify(false, errText(x)); }
    finally { setBusy(""); }
  }

  return (
    <div className="space-y-5">
      {localToast ? <p role={localToast.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${localToast.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{localToast.text}</p> : null}

      <form onSubmit={create} className={`${card} space-y-3`}>
        <h3 className="flex items-center gap-2 text-lg font-bold"><Plus className="h-5 w-5 text-violet-600" /> Новый дистрибьютор</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className={input} required minLength={2} maxLength={120} placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={input} required type="email" placeholder="Email (логин)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={input} placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={input} required minLength={8} type="password" autoComplete="new-password" placeholder="Пароль (от 8 символов)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button disabled={busy === "create"} className={`${btn} bg-violet-700 text-white hover:bg-violet-600`}>
          {busy === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Создать
        </button>
      </form>

      <div className={card}>
        <h3 className="mb-3 text-lg font-bold">Дистрибьюторы {rows.length ? <span className="text-sm font-normal text-slate-500">({rows.length})</span> : null}</h3>
        {loading ? <p className="py-6 text-center text-sm text-slate-500">Загрузка…</p> : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {rows.map((d) => (
              <li key={d.id} className="py-3">
                {editId === d.id ? (
                  <form onSubmit={(e) => void save(e, d.id)} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="text-xs font-semibold text-slate-500">Название<input className={`${input} mt-1`} required minLength={2} maxLength={120} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
                      <label className="text-xs font-semibold text-slate-500">Email<input className={`${input} mt-1`} required type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
                      <label className="text-xs font-semibold text-slate-500">Телефон<input className={`${input} mt-1`} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
                      <label className="text-xs font-semibold text-slate-500">Статус
                        <select className={`${input} mt-1`} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                          <option value="active">Активен</option><option value="blocked">Заблокирован</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-500 sm:col-span-1 lg:col-span-2"><span className="inline-flex items-center gap-1"><KeyRound className="h-3 w-3" /> Новый пароль (необязательно)</span>
                        <input className={`${input} mt-1`} type="password" minLength={8} autoComplete="new-password" placeholder="Оставьте пустым, чтобы не менять" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busy === `save-${d.id}`} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}>{busy === `save-${d.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Сохранить</button>
                      <button type="button" onClick={() => setEditId(null)} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200`}><X className="h-4 w-4" /> Отмена</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <span className="truncate">{d.name}</span>
                        {d.status === "blocked" ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">заблокирован</span> : null}
                      </p>
                      <p className="break-all text-slate-500">{d.email}{d.phone ? ` · ${d.phone}` : ""}</p>
                      <p className="text-xs text-slate-400">складов: {d.warehouses}{typeof d.products === "number" ? ` · товаров: ${d.products}` : ""}</p>
                    </div>
                    {confirmId === d.id ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-2 dark:bg-rose-950/30">
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-200">Удалить «{d.name}»? Товары останутся в каталоге, склад и аккаунт будут удалены.</span>
                        <button disabled={busy === `del-${d.id}`} onClick={() => void remove(d.id)} className={`${btn} bg-rose-600 text-white hover:bg-rose-500`}>{busy === `del-${d.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Да, удалить</button>
                        <button onClick={() => setConfirmId(null)} className={`${btn} bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>Отмена</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(d)} className={`${btn} bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-100`}><Pencil className="h-4 w-4" /> Изменить</button>
                        <button onClick={() => { setEditId(null); setConfirmId(d.id); }} className={`${btn} bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200`}><Trash2 className="h-4 w-4" /> Удалить</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
            {!rows.length ? <li className="py-4 text-center text-slate-500">Дистрибьюторов пока нет.</li> : null}
          </ul>
        )}
      </div>
    </div>
  );
}
