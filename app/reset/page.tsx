"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PasswordInput } from "@/components/auth-fields";
import { postJson } from "@/lib/api";

export default function ResetPage() {
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    // Relative URL + postJson: the user sees a readable Russian message instead
    // of a raw "Failed to fetch" when the server is down or answers with HTML.
    const result = await postJson(
      "/api/auth/reset-password",
      { emailOrPhone, code, password, confirmPassword },
      "Не удалось обновить пароль.",
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStatus(result.message || "Пароль успешно изменён");
    // Успех: перенаправляем на вход с подставленным email/телефоном.
    router.push(`/login?email=${encodeURIComponent(emailOrPhone.trim())}`);
  };

  return (
    <SiteShell>
      <section className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Сбросить пароль</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white">Новый пароль</h1>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <input type="text" required autoComplete="email tel" value={emailOrPhone} onChange={(event) => setEmailOrPhone(event.target.value)} placeholder="Email или телефон +992XXXXXXXXX" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Шестизначный код из письма или SMS" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            <PasswordInput id="reset-password" label="Новый пароль" value={password} onChange={setPassword} placeholder="Новый пароль" autoComplete="new-password" />
            <PasswordInput id="reset-confirm" label="Подтвердите новый пароль" value={confirmPassword} onChange={setConfirmPassword} placeholder="Подтвердите новый пароль" autoComplete="new-password" />
            {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
            {status ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{status}</div> : null}
            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-60">{loading ? "Обновляем…" : "Обновить пароль"}</button>
          </form>
        </div>
      </section>
    </SiteShell>
  );
}
