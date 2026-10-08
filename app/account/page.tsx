"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { PasswordInput } from "@/components/auth-fields";
import { formatTjs } from "@/lib/currency";

type AccountUser = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  avatar: string | null;
};

type AccountOrder = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  items: Array<{ id: string; name: string; quantity: number; lineTotal: number }>;
};

type Tab = "profile" | "orders" | "security";
const orderStatusLabels: Record<string, string> = { new: "Новый", processing: "В обработке", completed: "Завершён", cancelled: "Отменён" };
const orderStatusStyles: Record<string, string> = {
  new: "bg-sky-100 text-sky-700",
  processing: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-600",
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [emailForm, setEmailForm] = useState({ email: "", code: "" });
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");
  const [orderBusy, setOrderBusy] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken) {
      router.replace("/login");
      return;
    }
    const headers = { Authorization: `Bearer ${authToken}` };
    Promise.all([fetch("/api/profile", { headers }), fetch("/api/orders", { headers })])
      .then(async ([profileResponse, ordersResponse]) => {
        const profile = await profileResponse.json();
        const orderData = await ordersResponse.json();
        if (profileResponse.status === 401) {
          localStorage.removeItem("hasi-token");
          router.replace("/login");
          return;
        }
        if (!profileResponse.ok) throw new Error(profile.error || "Не удалось загрузить профиль.");
        if (!ordersResponse.ok) throw new Error(orderData.error || "Не удалось загрузить заказы.");
        setUser(profile.user);
        setForm({ firstName: profile.user.firstName, lastName: profile.user.lastName, phone: profile.user.phone });
        setEmailForm((current) => ({ ...current, email: profile.user.email }));
        setOrders(orderData.orders);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить данные аккаунта.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function saveProfile() {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken) return;
    setError("");
    setNotice("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить профиль.");
      setUser(result.user);
      setNotice("Данные профиля сохранены.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить профиль.");
    } finally {
      setIsSaving(false);
    }
  }

  async function requestEmailChange() {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ email: emailForm.email }),
      });
      const result = await response.json() as { message?: string; error?: string; devCode?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось отправить код.");
      setEmailCodeSent(true);
      setNotice(`${result.message || "Код отправлен на новый email."}${result.devCode ? ` Тестовый код: ${result.devCode}` : ""}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить код.");
    }
  }

  async function verifyEmailChange() {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(emailForm),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось подтвердить email.");
      const profileResponse = await fetch("/api/profile", { headers: { Authorization: `Bearer ${authToken}` } });
      const profile = await profileResponse.json() as { user?: AccountUser; error?: string };
      if (!profileResponse.ok || !profile.user) throw new Error(profile.error || "Не удалось обновить данные профиля.");
      setUser(profile.user);
      setEmailForm({ email: profile.user.email, code: "" });
      setEmailCodeSent(false);
      setNotice(result.message || "Email успешно изменён.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось подтвердить email.");
    }
  }

  async function changePassword() {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(passwordForm),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось изменить пароль.");
      setPasswordForm({ currentPassword: "", password: "", confirmPassword: "" });
      setNotice(result.message || "Пароль обновлён.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить пароль.");
    }
  }

  async function uploadAvatar(file: File | null) {
    const authToken = localStorage.getItem("hasi-token");
    if (!file || !authToken) return;
    setError("");
    setNotice("");
    setAvatarBusy(true);
    try {
      const body = new FormData();
      body.append("avatar", file);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body,
      });
      const result = await response.json() as { user?: AccountUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || "Не удалось загрузить фотографию.");
      setUser(result.user);
      setNotice("Фотография профиля обновлена.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить фотографию.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken) return;
    setError("");
    setNotice("");
    setAvatarBusy(true);
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { user?: AccountUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || "Не удалось удалить фотографию.");
      setUser(result.user);
      setNotice("Фотография профиля удалена.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить фотографию.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function cancelOrder(order: AccountOrder) {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken || !window.confirm(`Отменить заказ ${order.orderNumber || order.id.slice(0, 8)}?`)) return;
    setError("");
    setNotice("");
    setOrderBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ action: "cancel" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось отменить заказ.");
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: "cancelled" } : item));
      setNotice("Заказ отменён.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отменить заказ.");
    } finally {
      setOrderBusy("");
    }
  }

  async function removeOrder(order: AccountOrder) {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken || !window.confirm("Удалить заказ из истории? Это действие нельзя отменить.")) return;
    setError("");
    setNotice("");
    setOrderBusy(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось удалить заказ.");
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setNotice("Заказ удалён из истории.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить заказ.");
    } finally {
      setOrderBusy("");
    }
  }

  async function deleteAccount() {
    const authToken = localStorage.getItem("hasi-token");
    if (!authToken) return;
    if (!deletePassword) {
      setError("Введите пароль для подтверждения удаления аккаунта.");
      return;
    }
    if (!window.confirm("Удалить аккаунт навсегда? Профиль, избранное и корзина будут удалены безвозвратно.")) return;
    setError("");
    setNotice("");
    setDeleteBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ password: deletePassword }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось удалить аккаунт.");
      localStorage.removeItem("hasi-token");
      window.dispatchEvent(new Event("hasi-auth-changed"));
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить аккаунт.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function logout() {
    // Clears the httpOnly hasi-session cookie; the Bearer token is dropped below as before.
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue signing out even if the cookie cleanup request fails.
    }
    localStorage.removeItem("hasi-token");
    window.dispatchEvent(new Event("hasi-auth-changed"));
    router.replace("/");
  }

  if (loading) return <SiteShell><div className="mx-auto max-w-5xl px-4 py-16 text-slate-500">Загрузка профиля…</div></SiteShell>;

  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col items-center text-center">
              {user?.avatar ? <Image src={user.avatar} alt="" width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-2xl font-black text-violet-700">{user?.firstName.charAt(0)}</div>}
              <div className="mt-4 text-2xl font-black">{user?.firstName} {user?.lastName}</div>
              <div className="text-sm text-slate-500">{user?.email}</div>
              <div className="mt-3 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium uppercase text-violet-700">{user?.role}</div>
              <div className="mt-4 flex w-full flex-col gap-2">
                <label className={`inline-flex w-full cursor-pointer justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold dark:border-slate-700 ${avatarBusy ? "opacity-60" : ""}`}>
                  {user?.avatar ? "Изменить фото" : "Загрузить фото"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={avatarBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      void uploadAvatar(file);
                    }}
                  />
                </label>
                {user?.avatar ? (
                  <button type="button" onClick={() => void removeAvatar()} disabled={avatarBusy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-rose-600 disabled:opacity-60 dark:border-slate-700">
                    {avatarBusy ? "Удаление…" : "Удалить фото"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-8 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">Email: {user?.email}</div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">Телефон: {user?.phone}</div>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Link href="/favorites" className="text-violet-700 underline dark:text-violet-300">Избранное</Link>
              <Link href="/cart" className="text-violet-700 underline dark:text-violet-300">Корзина</Link>
            </div>
            <button type="button" onClick={() => void logout()} className="mt-3 inline-flex w-full justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700">Выйти</button>
          </aside>

          <div className="space-y-8">
            <div role="tablist" aria-label="Разделы личного кабинета" className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {([["profile", "Профиль"], ["orders", `Мои заказы${orders.length ? ` (${orders.length})` : ""}`], ["security", "Безопасность"]] as Array<[Tab, string]>).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setError(""); setNotice(""); }} className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition ${tab === id ? "bg-violet-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{label}</button>
              ))}
            </div>
            {tab !== "profile" && (error || notice) ? <div>{error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}{notice ? <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p> : null}</div> : null}
            {tab === "profile" ? (<>
<section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h1 className="text-3xl font-black">Личный кабинет</h1>
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-medium">Имя<input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800" /></label>
                <label className="text-sm font-medium">Фамилия<input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800" /></label>
                <label className="text-sm font-medium md:col-span-2">Телефон<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800" /></label>
              </div>
              {error ? <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p> : null}
              {notice ? <p role="status" className="mt-4 text-sm text-emerald-600">{notice}</p> : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => void saveProfile()} disabled={isSaving} className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{isSaving ? "Сохранение…" : "Сохранить изменения"}</button>
                <Link href="/catalog" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700">Продолжить покупки</Link>
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-black">Изменение email</h2>
              <p className="mt-2 text-sm text-slate-500">Новый email будет сохранён только после подтверждения кода из письма.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium md:col-span-2">Новый email<input type="email" required value={emailForm.email} onChange={(event) => setEmailForm({ ...emailForm, email: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800" /></label>
                {emailCodeSent ? <label className="text-sm font-medium md:col-span-2">Код из письма<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={emailForm.code} onChange={(event) => setEmailForm({ ...emailForm, code: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800" /></label> : null}
              </div>
              <button type="button" onClick={() => void (emailCodeSent ? verifyEmailChange() : requestEmailChange())} className="mt-5 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">{emailCodeSent ? "Подтвердить новый email" : "Отправить код на новый email"}</button>
            </section>

            </>) : null}
            {tab === "orders" ? (
<section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-black">Мои заказы</h2>
              {!orders.length ? (
                <div className="mt-4 text-sm text-slate-500">
                  <p>У вас пока нет оформленных заказов.</p>
                  <Link href="/catalog" className="mt-3 inline-flex rounded-xl bg-violet-700 px-4 py-2 font-bold text-white">Перейти в каталог</Link>
                </div>
              ) : (
                <div className="mt-5 space-y-3">{orders.map((order) => (
                  <article key={order.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                      <span>Заказ {order.orderNumber || order.id.slice(0, 8)}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${orderStatusStyles[order.status] || "bg-slate-200 text-slate-600"}`}>{orderStatusLabels[order.status] || order.status}</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {order.items.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.name} × {item.quantity}</span><span className="shrink-0">{formatTjs(item.lineTotal)}</span></li>)}
                    </ul>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <div>
                        <div className="font-bold">Итого: {formatTjs(order.total)}</div>
                        <div className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString("ru-RU")}</div>
                      </div>
                      <div className="flex gap-2">
                        {order.status === "new" || order.status === "processing" ? (
                          <button type="button" disabled={orderBusy === order.id} onClick={() => void cancelOrder(order)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 disabled:opacity-60">{orderBusy === order.id ? "Отмена…" : "Отменить заказ"}</button>
                        ) : null}
                        {order.status === "cancelled" ? (
                          <button type="button" disabled={orderBusy === order.id} onClick={() => void removeOrder(order)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200">{orderBusy === order.id ? "Удаление…" : "Удалить из истории"}</button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}</div>
              )}
            </section>
) : null}
            {tab === "security" ? (<>
<section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-black">Изменение пароля</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <PasswordInput id="account-current" label="Текущий пароль" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })} placeholder="Текущий пароль" autoComplete="current-password" required={false} minLength={1} />
                <PasswordInput id="account-new" label="Новый пароль" value={passwordForm.password} onChange={(value) => setPasswordForm({ ...passwordForm, password: value })} placeholder="Новый пароль" autoComplete="new-password" required={false} />
                <div className="md:col-span-2">
                  <PasswordInput id="account-confirm" label="Повторите новый пароль" value={passwordForm.confirmPassword} onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })} placeholder="Повторите новый пароль" autoComplete="new-password" required={false} />
                </div>
              </div>
              <button type="button" onClick={() => void changePassword()} className="mt-5 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">Сохранить пароль</button>
            </section>

            <section className="rounded-[30px] border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900 dark:bg-slate-900">
              <h2 className="text-2xl font-black text-rose-600">Удаление аккаунта</h2>
              <p className="mt-2 text-sm text-slate-500">Профиль, избранное и корзина будут удалены безвозвратно. История заказов сохранится в магазине без привязки к вашему аккаунту. Для подтверждения введите пароль.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="min-w-0 flex-1">
                  <PasswordInput id="account-delete" label="" value={deletePassword} onChange={setDeletePassword} placeholder="Ваш пароль" autoComplete="current-password" required={false} minLength={1} />
                </div>
                <button type="button" disabled={deleteBusy} onClick={() => void deleteAccount()} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{deleteBusy ? "Удаление…" : "Удалить мой аккаунт"}</button>
              </div>
            </section>
</>) : null}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
