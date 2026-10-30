"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ScanPicker } from "@/components/scan-picker";
import { DistributorsManager } from "@/components/distributors-manager";
import { formatTjs } from "@/lib/currency";
import { ACCOUNT_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/hasi-config";

type Identity = { fullName: string; passportNumber: string; birthDate: string; issuedBy: string; issueDate: string; registrationAddress: string; notes: string };
type IdentityView = Identity & { passportScanUrl: string; passportScanMime: string; passportBackUrl: string; passportBackMime: string };
type Dealer = {
  id: string; name: string; email: string; phone: string; status: string; createdAt: string;
  limit: number; used: number; available: number; payoutBalance: number; openOrders: number; identity: IdentityView | null;
};
type Totals = { hasiEarned: number; hasiPending: number; dealersToPay: number };
type AdminOrder = {
  id: string; orderNumber: string; customerName: string; phone: string; addressComment: string; total: number; status: string;
  createdAt: string; dealerName: string | null; items: Array<{ name: string; quantity: number }>;
};
type Settlement = {
  id: string; orderNumber: string; dealerName: string; amount: number; status: string; reportedAt: string;
  customerPaymentMethod: string | null; paymentReference: string; dealerCommission: number; hasiCommission: number;
};
type StockRow = { productId: string; name: string; sku: string; price: number; qty: number; purchasePrice: number };
type Sub = "dealers" | "orders" | "settlements" | "stock" | "distributors";

const subs: Array<[Sub, string]> = [["dealers", "Дилеры"], ["orders", "Заявки"], ["settlements", "Расчёты"], ["stock", "Склад и прайс"], ["distributors", "Дистрибьюторы"]];
const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const primary = "rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-600 disabled:opacity-60";
const ghost = "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800";
const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6";
const emptyIdentity: Identity = { fullName: "", passportNumber: "", birthDate: "", issuedBy: "", issueDate: "", registrationAddress: "", notes: "" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("hasi-token");
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
  return data;
}

export function HasiAdminPanel() {
  const [sub, setSub] = useState<Sub>("dealers");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const say = (ok: boolean, text: string) => setToast({ ok, text });

  return (
    <div className="space-y-5">
      <div role="tablist" className="flex flex-wrap gap-2">
        {subs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={sub === id} onClick={() => { setSub(id); setToast(null); }}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${sub === id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300"}`}>
            {label}
          </button>
        ))}
      </div>
      {toast ? <p role={toast.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{toast.text}</p> : null}
      {sub === "dealers" ? <DealersTab say={say} /> : null}
      {sub === "orders" ? <OrdersTab say={say} /> : null}
      {sub === "settlements" ? <SettlementsTab say={say} /> : null}
      {sub === "stock" ? <StockTab say={say} /> : null}
      {sub === "distributors" ? <DistributorsTab say={say} /> : null}
    </div>
  );
}

type SayProps = { say: (ok: boolean, text: string) => void };
const err = (e: unknown) => (e instanceof Error ? e.message : "Ошибка.");

/* ───── общие элементы оформления ───── */
const label = "block text-xs font-semibold text-slate-500 dark:text-slate-400";
const sectionTitle = "text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400";

function Pill({ tone, children }: { tone: "green" | "amber" | "red" | "blue" | "violet" | "gray"; children: React.ReactNode }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    gray: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  } as const;
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

const ACCOUNT_TONE: Record<string, "green" | "amber" | "red"> = { active: "green", pending: "amber", blocked: "red" };
const ORDER_TONE: Record<string, "green" | "amber" | "red" | "blue" | "violet" | "gray"> = {
  pending_dealer: "blue", accepted: "violet", issued: "amber", payment_reported: "amber", return_requested: "red", completed: "green", cancelled: "gray",
};

function Metric({ title, value, accent }: { title: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className={`mt-0.5 text-sm font-bold sm:text-base ${accent ? "text-violet-700 dark:text-violet-300" : "text-slate-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}

/* ───── Дилеры ───── */
type Side = "front" | "back";

function scanOf(identity: IdentityView | null, side: Side) {
  if (!identity) return null;
  const url = side === "front" ? identity.passportScanUrl : identity.passportBackUrl;
  const mime = side === "front" ? identity.passportScanMime : identity.passportBackMime;
  return url ? { url, mime } : null;
}

function buildForm(data: unknown, front: File | null, back: File | null) {
  const fd = new FormData();
  fd.set("data", JSON.stringify(data));
  if (front) fd.set("passportScan", front);
  if (back) fd.set("passportScanBack", back);
  return fd;
}

/** Две миниатюры (лицевая / оборотная сторона); клик открывает просмотр. */
function ScanThumbs({ identity, onOpen }: { identity: IdentityView | null; onOpen: (identity: IdentityView, side: Side) => void }) {
  const sides = (["front", "back"] as const).filter((side) => scanOf(identity, side));
  if (!identity || sides.length === 0) return <span className="text-xs text-slate-400">скан не загружен</span>;
  return (
    <div className="flex gap-2">
      {sides.map((side) => {
        const scan = scanOf(identity, side)!;
        return (
          <button key={side} type="button" onClick={() => onOpen(identity, side)} aria-label={side === "front" ? "Открыть лицевую сторону паспорта" : "Открыть оборотную сторону паспорта"}
            title={side === "front" ? "Лицевая сторона" : "Оборотная сторона"}
            className="relative h-14 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:ring-2 hover:ring-violet-400 dark:border-slate-700 dark:bg-slate-800">
            {scan.mime === "application/pdf"
              ? <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-rose-600">PDF</span>
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={scan.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
            <span className="absolute inset-x-0 bottom-0 bg-black/60 text-center text-[9px] font-bold text-white">{side === "front" ? "1" : "2"}</span>
          </button>
        );
      })}
    </div>
  );
}

function Lightbox({ identity, initialSide, onClose }: { identity: IdentityView; initialSide: Side; onClose: () => void }) {
  const [side, setSide] = useState<Side>(initialSide);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const scan = scanOf(identity, side);
  const both = scanOf(identity, "front") && scanOf(identity, "back");
  return (
    <div role="dialog" aria-modal="true" aria-label="Скан паспорта" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 sm:p-6" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-white">
          <p className="min-w-0 truncate text-sm font-semibold">{identity.fullName} · {identity.passportNumber}</p>
          <div className="flex gap-2">
            {both ? (["front", "back"] as const).map((item) => (
              <button key={item} onClick={() => setSide(item)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${side === item ? "bg-white text-slate-900" : "bg-white/15 hover:bg-white/25"}`}>
                {item === "front" ? "Лицевая" : "Оборотная"}
              </button>
            )) : null}
            {scan ? <a href={scan.url} target="_blank" rel="noreferrer" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">В новой вкладке</a> : null}
            <button onClick={onClose} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">Закрыть</button>
          </div>
        </div>
        {scan?.mime === "application/pdf"
          ? <iframe src={scan.url} title="Скан паспорта (PDF)" className="h-[80vh] w-full rounded-xl bg-white" />
          // eslint-disable-next-line @next/next/no-img-element
          : scan ? <img src={scan.url} alt="Скан паспорта" className="max-h-[80vh] w-full rounded-xl bg-white object-contain" /> : null}
      </div>
    </div>
  );
}

function IdentityFields({ value, set }: { value: Identity; set: (i: Identity) => void }) {
  const f = (key: keyof Identity, title: string, placeholder: string, extra = "") => (
    <label className={`${label} ${extra}`}>{title}
      <input className={`${input} mt-1`} required={key === "fullName" || key === "passportNumber"} placeholder={placeholder} value={value[key]} onChange={(e) => set({ ...value, [key]: e.target.value })} />
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {f("fullName", "ФИО по паспорту", "Иванов Иван Иванович")}
      {f("passportNumber", "Серия и номер паспорта", "A0123456")}
      {f("birthDate", "Дата рождения", "01.01.1990")}
      {f("issuedBy", "Кем выдан", "ОВД г. Худжанд")}
      {f("issueDate", "Дата выдачи", "01.01.2020")}
      {f("registrationAddress", "Адрес регистрации", "г. Худжанд, ул. …")}
      {f("notes", "Заметки", "необязательно", "sm:col-span-2")}
    </div>
  );
}

const PASSPORT_RE = /^[\p{L}\p{N} -]{5,30}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Проверка формы до отправки: понятное сообщение вместо ошибки сервера. */
function validateDealer(v: { name: string; email: string; phone: string; password?: string; limit: string; identity: Identity }, needPassword: boolean): string | null {
  if (v.name.trim().length < 2) return "Укажите ФИО дилера (минимум 2 символа).";
  if (!EMAIL_RE.test(v.email.trim())) return "Укажите корректный email — он будет логином дилера.";
  if (v.phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(v.phone.trim())) return "Телефон: только цифры, пробелы, + и дефис (7–20 символов).";
  if (needPassword && (v.password ?? "").length < 8) return "Пароль — минимум 8 символов.";
  if (!needPassword && v.password && v.password.length < 8) return "Новый пароль — минимум 8 символов (или оставьте поле пустым).";
  if (v.limit.trim() !== "" && !(Number(v.limit) >= 0)) return "Лимит должен быть числом от 0.";
  if (v.identity.fullName.trim().length < 3) return "Укажите ФИО по паспорту.";
  if (!PASSPORT_RE.test(v.identity.passportNumber.trim())) return "Серия и номер паспорта: 5–30 символов (буквы, цифры, пробел, дефис).";
  return null;
}

type EditState = {
  id: string; name: string; email: string; phone: string; password: string; status: string; limit: string;
  identity: Identity; current: IdentityView | null; front: File | null; back: File | null;
};

export function DealersManager() {
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-5">
      {toast ? <p role={toast.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${toast.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}>{toast.text}</p> : null}
      <DealersTab say={(ok, text) => setToast({ ok, text })} />
    </div>
  );
}

const emptyDealerForm = { name: "", email: "", phone: "", password: "", status: "active", limit: "", identity: emptyIdentity };

function DealersTab({ say }: SayProps) {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [defaultLimit, setDefaultLimit] = useState(10000);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyDealerForm);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [viewer, setViewer] = useState<{ identity: IdentityView; side: Side } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api<{ dealers: Dealer[]; defaultLimit: number; totals: Totals }>("/api/admin/dealers");
      setDealers(d.dealers); setDefaultLimit(d.defaultLimit); setTotals(d.totals);
    } catch (e) { say(false, err(e)); } finally { setLoading(false); }
  }, [say]);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const problem = validateDealer(form, true);
    if (problem) return say(false, problem);
    setBusy(true);
    try {
      await api("/api/admin/dealers", { method: "POST", body: buildForm({ ...form, limit: form.limit === "" ? null : Number(form.limit) }, front, back) });
      setForm(emptyDealerForm); setFront(null); setBack(null); setShowForm(false);
      say(true, "Дилер создан. Передайте ему email и пароль для входа."); await load();
    } catch (x) { say(false, err(x)); } finally { setBusy(false); }
  }

  function startEdit(d: Dealer) {
    const { passportScanUrl, passportScanMime, passportBackUrl, passportBackMime, ...identity } = d.identity ?? { ...emptyIdentity, passportScanUrl: "", passportScanMime: "", passportBackUrl: "", passportBackMime: "" };
    void passportScanUrl; void passportScanMime; void passportBackUrl; void passportBackMime;
    setEditing({ id: d.id, name: d.name, email: d.email, phone: d.phone, password: "", status: d.status, limit: String(d.limit), identity, current: d.identity, front: null, back: null });
  }

  async function save() {
    if (!editing) return;
    const problem = validateDealer(editing, false);
    if (problem) return say(false, problem);
    setBusy(true);
    try {
      await api(`/api/admin/dealers/${editing.id}`, {
        method: "PATCH",
        body: buildForm({
          name: editing.name, email: editing.email, phone: editing.phone, status: editing.status, limit: Number(editing.limit),
          identity: editing.identity, ...(editing.password ? { password: editing.password } : {}),
        }, editing.front, editing.back),
      });
      setEditing(null); say(true, "Изменения сохранены."); await load();
    } catch (x) { say(false, err(x)); } finally { setBusy(false); }
  }

  async function remove(d: Dealer) {
    if (!confirm(`Вы уверены, что хотите удалить этого дилера?\n\n${d.name} (${d.email})`)) return;
    try {
      const r = await api<{ message: string }>(`/api/admin/dealers/${d.id}`, { method: "DELETE" });
      say(true, r.message); await load();
    } catch (x) { say(false, err(x)); }
  }

  async function payout(d: Dealer) {
    if (!confirm(`Выплатить ${formatTjs(d.payoutBalance)} дилеру ${d.name}?`)) return;
    try { const r = await api<{ paidOut: number }>(`/api/admin/dealers/${d.id}/payout`, { method: "POST" }); say(true, `Выплачено ${formatTjs(r.paidOut)}.`); await load(); }
    catch (x) { say(false, err(x)); }
  }

  async function saveDefault() {
    try { await api("/api/admin/hasi/settings", { method: "PUT", body: JSON.stringify({ defaultLimit }) }); say(true, "Базовый лимит обновлён (для новых дилеров)."); }
    catch (x) { say(false, err(x)); }
  }

  return (
    <div className="space-y-5">
      {totals ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={card}><p className="text-xs text-slate-500">HASI Market заработал (7%)</p><p className="mt-1 text-2xl font-black">{formatTjs(totals.hasiEarned)}</p><p className="text-xs text-slate-500">ожидает: {formatTjs(totals.hasiPending)}</p></div>
          <div className={card}><p className="text-xs text-slate-500">К выплате дилерам (3%)</p><p className="mt-1 text-2xl font-black text-violet-700 dark:text-violet-300">{formatTjs(totals.dealersToPay)}</p></div>
          <div className={card}>
            <p className="text-xs text-slate-500">Базовый лимит нового дилера, сомони</p>
            <div className="mt-2 flex gap-2"><input className={input} type="number" min={0} value={defaultLimit} onChange={(e) => setDefaultLimit(Number(e.target.value))} /><button className={primary} onClick={() => void saveDefault()}>Сохранить</button></div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">Дилеры <span className="text-sm font-semibold text-slate-500">({dealers.length})</span></h2>
        <button onClick={() => setShowForm((v) => !v)} className={primary}>{showForm ? "Закрыть форму" : "+ Новый дилер"}</button>
      </div>

      {showForm ? (
        <form onSubmit={create} noValidate className={`${card} space-y-6`}>
          <div className="space-y-3">
            <h3 className={sectionTitle}>Аккаунт дилера</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>ФИО дилера<input className={`${input} mt-1`} required placeholder="Имя Фамилия" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className={label}>Email (логин)<input className={`${input} mt-1`} type="email" required placeholder="dealer@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className={label}>Телефон<input className={`${input} mt-1`} type="tel" placeholder="+992…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label className={label}>Пароль (минимум 8 символов)<input className={`${input} mt-1`} required minLength={8} placeholder="Придумайте пароль" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              <label className={label}>Статус
                <select className={`${input} mt-1`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(ACCOUNT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className={label}>Лимит, сомони<input className={`${input} mt-1`} type="number" min={0} placeholder={`По умолчанию ${defaultLimit}`} value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} /></label>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className={sectionTitle}>Паспортные данные</h3>
            <IdentityFields value={form.identity} set={(identity) => setForm({ ...form, identity })} />
          </div>
          <div className="space-y-3">
            <h3 className={sectionTitle}>Фото паспорта</h3>
            <p className="text-xs text-slate-500">На телефоне «Снять камерой» открывает камеру. Фото уменьшается автоматически. Форматы: JPG, PNG, WEBP, PDF.</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <ScanPicker label="Лицевая сторона (разворот с фото)" file={front} onChange={setFront} onError={(m) => say(false, m)} />
              <ScanPicker label="Оборотная сторона (прописка)" file={back} onChange={setBack} onError={(m) => say(false, m)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} className={primary}>{busy ? "Создаём…" : "Создать дилера"}</button>
            <button type="button" onClick={() => setShowForm(false)} className={ghost}>Отмена</button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Загружаем дилеров…</p> : null}
      {!loading && dealers.length === 0 ? <div className={`${card} text-center text-sm text-slate-500`}>Дилеров пока нет. Нажмите «+ Новый дилер».</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {dealers.map((d) => (
          <article key={d.id} className={`${card} flex flex-col gap-4`}>
            <header className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg font-black text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{d.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{d.name}</p>
                  <p className="truncate text-sm text-slate-500">{d.email}</p>
                  {d.phone ? <p className="text-sm text-slate-500">{d.phone}</p> : null}
                </div>
              </div>
              <Pill tone={ACCOUNT_TONE[d.status] ?? "gray"}>{ACCOUNT_STATUS_LABELS[d.status] ?? d.status}</Pill>
            </header>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Metric title="Лимит" value={formatTjs(d.limit)} />
              <Metric title="Занято" value={formatTjs(d.used)} />
              <Metric title="Доступно" value={formatTjs(d.available)} />
              <Metric title="К выплате" value={formatTjs(d.payoutBalance)} accent />
              <Metric title="Открытых заявок" value={d.openOrders} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Паспорт</p>
                <p className="truncate text-sm font-semibold">{d.identity?.passportNumber || "—"}</p>
              </div>
              <ScanThumbs identity={d.identity} onOpen={(identity, side) => setViewer({ identity, side })} />
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              <button className={ghost} onClick={() => startEdit(d)}>Изменить</button>
              {d.payoutBalance > 0 ? <button className={ghost} onClick={() => void payout(d)}>Выплатить {formatTjs(d.payoutBalance)}</button> : null}
              <button className={`${ghost} ml-auto border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10`} onClick={() => void remove(d)} aria-label={`Удалить дилера ${d.name}`}>Удалить</button>
            </div>
          </article>
        ))}
      </div>

      {editing ? (
        <div role="dialog" aria-modal="true" aria-label="Редактирование дилера" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-0 sm:p-4" onClick={() => !busy && setEditing(null)}>
          <div className={`${card} my-0 min-h-full w-full max-w-3xl space-y-6 rounded-none sm:my-8 sm:min-h-0 sm:rounded-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Редактирование дилера</h3>
              <button onClick={() => setEditing(null)} disabled={busy} aria-label="Закрыть" className="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">×</button>
            </div>
            <div className="space-y-3">
              <h4 className={sectionTitle}>Аккаунт</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>ФИО дилера<input className={`${input} mt-1`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
                <label className={label}>Email<input className={`${input} mt-1`} type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label>
                <label className={label}>Номер телефона<input className={`${input} mt-1`} type="tel" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></label>
                <label className={label}>Лимит, сомони<input className={`${input} mt-1`} type="number" min={0} value={editing.limit} onChange={(e) => setEditing({ ...editing, limit: e.target.value })} /></label>
                <label className={label}>Статус
                  <select className={`${input} mt-1`} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                    {Object.entries(ACCOUNT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className={label}>Новый пароль (необязательно)<input className={`${input} mt-1`} placeholder="Оставьте пустым, чтобы не менять" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} /></label>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className={sectionTitle}>Паспортные данные</h4>
              <IdentityFields value={editing.identity} set={(identity) => setEditing({ ...editing, identity })} />
            </div>
            <div className="space-y-3">
              <h4 className={sectionTitle}>Фото паспорта</h4>
              <div className="grid gap-3 lg:grid-cols-2">
                <ScanPicker label="Лицевая сторона" file={editing.front} onChange={(front) => setEditing({ ...editing, front })} onError={(m) => say(false, m)}
                  existing={scanOf(editing.current, "front")} onOpenExisting={() => editing.current && setViewer({ identity: editing.current, side: "front" })} />
                <ScanPicker label="Оборотная сторона" file={editing.back} onChange={(back) => setEditing({ ...editing, back })} onError={(m) => say(false, m)}
                  existing={scanOf(editing.current, "back")} onOpenExisting={() => editing.current && setViewer({ identity: editing.current, side: "back" })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} className={primary} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить"}</button>
              <button disabled={busy} className={ghost} onClick={() => setEditing(null)}>Отмена</button>
            </div>
          </div>
        </div>
      ) : null}

      {viewer ? <Lightbox identity={viewer.identity} initialSide={viewer.side} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}

/* ───── Заявки ───── */
const ORDER_FILTERS: Array<[string, string]> = [
  ["", "Все"], ["pending_dealer", "Свободные"], ["accepted", "Принятые"], ["issued", "Товар выдан"],
  ["payment_reported", "Оплата на проверке"], ["return_requested", "Возврат"], ["completed", "Завершённые"], ["cancelled", "Отменённые"],
];

export function OrdersManager() {
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-5">
      {toast ? <p role={toast.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${toast.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}>{toast.text}</p> : null}
      <OrdersTab say={(ok, text) => setToast({ ok, text })} />
    </div>
  );
}

function OrdersTab({ say }: SayProps) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setOrders((await api<{ orders: AdminOrder[] }>(`/api/admin/hasi/orders${status ? `?status=${status}` : ""}`)).orders); }
    catch (e) { say(false, err(e)); } finally { setLoading(false); }
  }, [status, say]);
  useEffect(() => { void load(); }, [load]);

  const filteredOrders = orders.filter((order) => {
    const q = search.trim().toLocaleLowerCase("ru-RU");
    if (!q) return true;
    return [order.orderNumber, order.customerName, order.dealerName || "", order.phone, order.addressComment, ...order.items.map((item) => item.name)]
      .some((value) => String(value || "").toLocaleLowerCase("ru-RU").includes(q));
  });

  async function cancel(o: AdminOrder) {
    const goodsOut = ["issued", "payment_reported", "return_requested"].includes(o.status);
    const text = o.status === "return_requested"
      ? `Подтвердить возврат по заявке ${o.orderNumber}?\nТовар вернётся на склад, лимит дилера освободится.`
      : goodsOut
        ? `Отменить заявку ${o.orderNumber}?\nТовар уже выдан дилеру: он вернётся на склад, лимит дилера освободится.`
        : `Отменить заявку ${o.orderNumber}?`;
    if (!confirm(text)) return;
    try {
      const r = await api<{ returned: boolean }>(`/api/admin/hasi/orders/${o.id}`, { method: "POST", body: JSON.stringify({ action: "cancel" }) });
      say(true, r.returned ? "Заявка отменена, товар возвращён на склад." : "Заявка отменена."); await load();
    } catch (e) { say(false, err(e)); }
  }

  async function remove(o: AdminOrder) {
    const extra = o.status === "completed" ? "\nЭто удалит и расчёты/комиссии по заявке." : ["issued", "payment_reported", "return_requested"].includes(o.status) ? "\nТовар вернётся на склад." : "";
    if (!confirm(`Удалить заявку ${o.orderNumber} из базы без возможности восстановления?${extra}`)) return;
    try { await api(`/api/admin/hasi/orders/${o.id}`, { method: "DELETE" }); say(true, "Заявка удалена."); await load(); }
    catch (e) { say(false, err(e)); }
  }

  return (
    <div className="space-y-4">
      <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Поиск заказов</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Номер заказа, клиент, дилер, телефон или товар…" aria-label="Поиск по заказам" className={`${input} w-full`} /></label>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Фильтр по статусу">
        {ORDER_FILTERS.map(([value, title]) => (
          <button key={value} role="tab" aria-selected={status === value} onClick={() => setStatus(value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${status === value ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            {title}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-slate-500">Загружаем заявки…</p> : null}
      {!loading && filteredOrders.length === 0 ? <div className={`${card} text-center text-sm text-slate-500`}>{orders.length ? "По вашему запросу заказы не найдены." : "Заявок нет."}</div> : null}

      <div className="space-y-3">
        {filteredOrders.map((o) => (
          <article key={o.id} className={`${card} space-y-4`}>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-base font-black sm:text-lg">{o.orderNumber}</p>
                <p className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString("ru-RU")}</p>
              </div>
              <div className="flex items-center gap-3">
                <Pill tone={ORDER_TONE[o.status] ?? "gray"}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</Pill>
                <span className="text-lg font-black">{formatTjs(o.total)}</span>
              </div>
            </header>

            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Покупатель</p><p className="mt-1 font-semibold">{o.customerName}</p><a href={`tel:${o.phone}`} className="text-violet-700 underline dark:text-violet-300">{o.phone}</a></div>
              <div className="sm:col-span-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Адрес / комментарий</p><p className="mt-1 whitespace-pre-line break-words">{o.addressComment || "—"}</p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Дилер</p><p className="mt-1 font-semibold">{o.dealerName || "— не назначен"}</p></div>
            </div>

            <ul className="divide-y divide-slate-100 rounded-xl bg-slate-50 px-3 text-sm dark:divide-slate-700 dark:bg-slate-800/50">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 py-2"><span className="min-w-0 break-words">{i.name}</span><span className="shrink-0 font-semibold">× {i.quantity}</span></li>
              ))}
            </ul>

            <div className="flex flex-wrap justify-end gap-2">
              {o.status === "return_requested" ? <button className={primary} onClick={() => void cancel(o)}>Подтвердить возврат</button> : null}
              {["pending_dealer", "accepted", "issued", "payment_reported"].includes(o.status) ? <button className={ghost} onClick={() => void cancel(o)}>Отменить</button> : null}
              <button className={`${ghost} border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10`} onClick={() => void remove(o)}>Удалить</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ───── Расчёты ───── */
const SETTLEMENT_FILTERS: Array<[string, string]> = [["pending", "Ждут подтверждения"], ["confirmed", "Подтверждённые"], ["rejected", "Отклонённые"], ["", "Все"]];

function SettlementsTab({ say }: SayProps) {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await api<{ settlements: Settlement[] }>(`/api/admin/hasi/settlements${status ? `?status=${status}` : ""}`)).settlements); }
    catch (e) { say(false, err(e)); } finally { setLoading(false); }
  }, [status, say]);
  useEffect(() => { void load(); }, [load]);

  async function act(item: Settlement, action: "confirm" | "reject") {
    const note = action === "reject" ? prompt("Причина отклонения (необязательно):") ?? "" : "";
    try {
      await api(`/api/admin/hasi/settlements/${item.id}`, { method: "POST", body: JSON.stringify({ action, note }) });
      say(true, action === "confirm" ? "Оплата подтверждена: лимит освобождён, 3% зачислены дилеру." : "Оплата отклонена."); await load();
    } catch (e) { say(false, err(e)); }
  }

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SETTLEMENT_FILTERS.map(([value, title]) => (
          <button key={value} onClick={() => setStatus(value)} aria-pressed={status === value}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${status === value ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{title}</button>
        ))}
      </div>
      {loading ? <p className="text-sm text-slate-500">Загружаем расчёты…</p> : null}
      {!loading && rows.length === 0 ? <div className={`${card} text-center text-sm text-slate-500`}>Расчётов нет.</div> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((item) => (
          <article key={item.id} className={`${card} space-y-3`}>
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="break-all font-mono font-black">{item.orderNumber}</p><p className="text-xs text-slate-500">{new Date(item.reportedAt).toLocaleString("ru-RU")} · {item.dealerName}</p></div>
              <Pill tone={item.status === "pending" ? "amber" : item.status === "confirmed" ? "green" : "red"}>{item.status === "pending" ? "Ждёт" : item.status === "confirmed" ? "Подтверждён" : "Отклонён"}</Pill>
            </header>
            <div className="grid grid-cols-3 gap-2">
              <Metric title="Оплатить складу" value={formatTjs(item.amount)} />
              <Metric title="Дилеру 3%" value={formatTjs(item.dealerCommission)} accent />
              <Metric title="HASI 7%" value={formatTjs(item.hasiCommission)} />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Покупатель заплатил: <b>{item.customerPaymentMethod === "cash" ? "наличными" : item.customerPaymentMethod === "transfer" ? "переводом" : "—"}</b>{item.paymentReference ? ` · ${item.paymentReference}` : ""}</p>
            {item.status === "pending" ? (
              <div className="flex flex-wrap gap-2"><button className={primary} onClick={() => void act(item, "confirm")}>Подтвердить оплату</button><button className={ghost} onClick={() => void act(item, "reject")}>Отклонить</button></div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

/* ───── Склад и прайс ───── */
function StockTab({ say }: SayProps) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [draft, setDraft] = useState<Record<string, { qty: string; purchasePrice: string }>>({});
  const [q, setQ] = useState("");
  const load = useCallback(async () => {
    try { setRows((await api<{ stock: StockRow[] }>("/api/admin/hasi/stock")).stock); setDraft({}); }
    catch (e) { say(false, err(e)); }
  }, [say]);
  useEffect(() => { void load(); }, [load]);

  async function save(r: StockRow) {
    const d = draft[r.productId]; if (!d) return;
    try {
      await api(`/api/admin/hasi/stock/${r.productId}`, { method: "PATCH", body: JSON.stringify({ qty: Number(d.qty), purchasePrice: Number(d.purchasePrice) }) });
      say(true, `«${r.name}» обновлён.`); await load();
    } catch (e) { say(false, err(e)); }
  }

  const shown = rows.filter((r) => !q || `${r.name} ${r.sku}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className={`${card} space-y-4`}>
      <p className="text-sm text-slate-500">Остаток центрального склада HASI и закупочная цена по прайс-листу (по умолчанию розница ÷ 1,10). Остаток синхронно отображается на витрине.</p>
      <input className={`${input} max-w-xs`} placeholder="Поиск по названию / SKU" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2">Товар</th><th>Розница</th><th>Закупка</th><th>Остаток</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((r) => {
              const d = draft[r.productId] ?? { qty: String(r.qty), purchasePrice: String(r.purchasePrice) };
              const dirty = Boolean(draft[r.productId]);
              return (
                <tr key={r.productId}>
                  <td className="py-2"><p className="font-semibold">{r.name}</p><p className="text-xs text-slate-500">{r.sku}</p></td>
                  <td>{formatTjs(r.price)}</td>
                  <td><input className={`${input} w-28`} type="number" min={0} step="0.01" value={d.purchasePrice} onChange={(e) => setDraft({ ...draft, [r.productId]: { ...d, purchasePrice: e.target.value } })} /></td>
                  <td><input className={`${input} w-24`} type="number" min={0} step={1} value={d.qty} onChange={(e) => setDraft({ ...draft, [r.productId]: { ...d, qty: e.target.value } })} /></td>
                  <td className="text-right"><button className={primary} disabled={!dirty} onClick={() => void save(r)}>Сохранить</button></td>
                </tr>
              );
            })}
            {!shown.length ? <tr><td colSpan={5} className="py-6 text-center text-slate-500">Товаров нет.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───── Дистрибьюторы ───── */
function DistributorsTab({ say }: SayProps) {
  return <DistributorsManager say={say} />;
}
