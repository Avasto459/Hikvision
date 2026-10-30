"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { PasswordInput } from "@/components/auth-fields";
import { postJson } from "@/lib/api";

export default function RecoverPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState("");
  // Шаг 2: поля нового пароля открываются только после проверки кода на сервере.
  const [codeVerified, setCodeVerified] = useState(false);

  const identifier = method === "email" ? email.trim() : phone.trim();

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    // Relative URL: the API lives on the same origin as the page.
    // postJson never throws — network failures and HTML answers become `message`.
    const result = await postJson<{ devCode?: string }>(
      method === "email" ? "/api/auth/forgot-password" : "/api/auth/forgot-password/phone",
      method === "email" ? { email } : { phone },
      "Не удалось отправить код.",
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // Тестовый режим (SMTP не настроен или недоступен): API вернул код — показываем его
    // в подсказке, но поле НЕ заполняем само: код нужно ввести вручную.
    setDevCode(result.data.devCode || "");
    setCode("");
    setStatus(result.message || "Код отправлен. Введите его ниже вместе с новым паролем.");
    // Выпущенный код нужно подтвердить заново, поля пароля скрываются.
    setCodeVerified(false);
    setStep(2);
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    // Шаг 2 (gate): API сверяет код с HMAC-хэшем в SQLite, не расходуя его.
    const result = await postJson(
      "/api/auth/verify-reset-code",
      { emailOrPhone: identifier, code },
      "Не удалось проверить код.",
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCodeVerified(true);
    setStatus(result.message);
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    const result = await postJson(
      "/api/auth/reset-password",
      { emailOrPhone: identifier, code, password, confirmPassword },
      "Не удалось обновить пароль.",
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStatus(result.message);
    // Успех: перенаправляем на вход с подставленным email/телефоном.
    router.push(`/login?email=${encodeURIComponent(identifier)}`);
  };

  const switchMethod = (next: "email" | "phone") => {
    setMethod(next);
    setError("");
    setStatus("");
    setStep(1);
    setCode("");
    setDevCode("");
    setCodeVerified(false);
  };

  return (
    <SiteShell>
      <section className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Восстановление</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white">Сбросить пароль</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {step === 1 ? "Шаг 1 из 2 — укажите контакт и получите код." : "Шаг 2 из 2 — введите 6-значный код и новый пароль."}
          </p>
          {step === 1 ? (
          <form onSubmit={handleSendCode} className="mt-8 space-y-5">
            <div>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => switchMethod("email")} aria-pressed={method === "email"} className={`rounded-full px-4 py-2 text-sm font-semibold ${method === "email" ? "bg-violet-700 text-white" : "border border-slate-200 dark:border-slate-700"}`}>По email</button>
                <button type="button" onClick={() => switchMethod("phone")} aria-pressed={method === "phone"} className={`rounded-full px-4 py-2 text-sm font-semibold ${method === "phone" ? "bg-violet-700 text-white" : "border border-slate-200 dark:border-slate-700"}`}>По телефону</button>
              </div>
              {method === "email" ? (
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email
                  <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
              ) : (
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Номер телефона
                  <input type="tel" required autoComplete="tel" placeholder="+992XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
              )}
            </div>
            {error ? <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {status ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{status}</div> : null}
            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-70">
              {loading ? "Отправляем..." : method === "email" ? "Отправить код на email" : "Отправить SMS-код"}
            </button>
          </form>
          ) : (
          <form onSubmit={codeVerified ? handleResetPassword : handleVerifyCode} className="mt-8 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Код отправлен. Если нужно исправить контакт —{" "}
              <button type="button" onClick={() => { setStep(1); setError(""); setStatus(""); setDevCode(""); setCodeVerified(false); }} className="font-semibold text-violet-700 underline dark:text-violet-300">вернуться к шагу 1</button>
            </div>
            <div>
              <label htmlFor="recover-code" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">6-значный код из сообщения</label>
              <input id="recover-code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => {
                const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                // Изменённый код снова требует проверки перед вводом пароля.
                if (codeVerified) { setCodeVerified(false); setStatus(""); }
              }} placeholder="123456" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            {devCode ? (
              <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <strong>Тестовый режим: отправка email отключена, используйте код из подсказки.</strong> Код: <strong className="font-mono text-lg tracking-widest">{devCode}</strong> — введите его в поле выше.
                <button type="button" onClick={() => setCode(devCode)} className="ml-2 font-semibold underline">Вставить код</button>
              </p>
            ) : null}
            {codeVerified ? (
              <>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  Код подтверждён — теперь введите новый пароль.
                </div>
                <PasswordInput id="recover-password" label="Новый пароль" value={password} onChange={setPassword} placeholder="Минимум 8 символов" autoComplete="new-password" />
                <PasswordInput id="recover-confirm" label="Подтвердите новый пароль" value={confirmPassword} onChange={setConfirmPassword} placeholder="Повторите новый пароль" autoComplete="new-password" />
              </>
            ) : null}
            {error ? <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {status ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{status}</div> : null}
            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-60">
              {loading ? (codeVerified ? "Обновляем…" : "Проверяем…") : codeVerified ? "Обновить пароль" : "Продолжить"}
            </button>
            <button type="button" onClick={(event) => void handleSendCode(event as unknown as React.FormEvent)} disabled={loading} className="w-full text-center text-sm font-semibold text-slate-500 underline hover:text-violet-600 dark:text-slate-400">
              Не пришёл код? Отправить повторно
            </button>
          </form>
          )}
          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-violet-700 underline dark:text-violet-300">Вернуться ко входу</Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
