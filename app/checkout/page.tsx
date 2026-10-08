"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { useCart } from "@/components/store-provider";
import { formatTjs } from "@/lib/currency";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

export default function CheckoutPage() {
  const { items, total, ready, clearCart } = useCart();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", address: "", city: "", comment: "" });
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("hasi-token");
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          items: items.map(({ id, quantity }) => ({ productId: id, quantity })),
        }),
      });
      const data = await response.json() as { orderNumber?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось оформить заказ.");
      setOrderNumber(data.orderNumber || "");
      clearCart();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось оформить заказ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {orderNumber ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            <h1 className="text-3xl font-black">Заказ успешно оформлен!</h1>
            <p className="mt-3">Номер заказа: <strong>{orderNumber}</strong>. Мы свяжемся с вами для подтверждения.</p>
            <Link href="/catalog" className="mt-6 inline-flex rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white">Продолжить покупки</Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Оформление заказа</h1>
            {!ready ? <p className="mt-6 text-slate-500">Загружаем корзину…</p> : null}
            {ready && items.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <p>Корзина пуста. Добавьте товары перед оформлением.</p>
                <Link href="/catalog" className="mt-4 inline-flex text-violet-700 underline">Открыть каталог</Link>
              </div>
            ) : null}
            {ready && items.length > 0 ? (
              <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-xl font-bold">Данные для доставки</h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Имя<input required maxLength={200} autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={`${inputClass} mt-2`} /></label>
                    <label className="text-sm font-medium">Фамилия<input required maxLength={200} autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={`${inputClass} mt-2`} /></label>
                    <label className="text-sm font-medium sm:col-span-2">Телефон<input required type="tel" maxLength={200} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${inputClass} mt-2`} /></label>
                    <label className="text-sm font-medium sm:col-span-2">Email<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inputClass} mt-2`} /></label>
                    <label className="text-sm font-medium sm:col-span-2">Адрес<input required maxLength={200} autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${inputClass} mt-2`} /></label>
                    <label className="text-sm font-medium sm:col-span-2">Город<input required maxLength={200} autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={`${inputClass} mt-2`} /></label>
                    <label className="text-sm font-medium sm:col-span-2">Комментарий<textarea maxLength={1000} rows={4} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className={`${inputClass} mt-2`} /></label>
                  </div>
                  {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
                  <button type="submit" disabled={submitting || !items.length} className="mt-6 w-full rounded-full bg-violet-700 px-5 py-3 font-semibold text-white hover:bg-violet-600 disabled:opacity-50">
                    {submitting ? "Оформляем…" : "Оформить заказ"}
                  </button>
                </div>
                <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-xl font-bold">Ваш заказ</h2>
                  <div className="mt-5 space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-4 text-sm">
                        <span>{item.name} × {item.quantity}</span>
                        <span className="shrink-0 font-semibold">{formatTjs(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex justify-between border-t border-slate-200 pt-4 font-black dark:border-slate-700"><span>Итого</span><span>{formatTjs(total)}</span></div>
                </aside>
              </form>
            ) : null}
          </>
        )}
      </section>
    </SiteShell>
  );
}
