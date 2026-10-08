"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { SiteShell } from "@/components/site-shell";

type Country = {
  code: string;
  name: string;
  dial: string;
  flag: string;
  maxLength: number;
  placeholder: string;
};

const COUNTRIES: Country[] = [
  { code: "TJ", name: "Таджикистан", dial: "+992", flag: "🇹🇯", maxLength: 9, placeholder: "93 123 4567" },
  { code: "RU", name: "Россия", dial: "+7", flag: "🇷🇺", maxLength: 10, placeholder: "900 123 4567" },
  { code: "UZ", name: "Узбекистан", dial: "+998", flag: "🇺🇿", maxLength: 9, placeholder: "90 123 4567" },
  { code: "KG", name: "Кыргызстан", dial: "+996", flag: "🇰🇬", maxLength: 9, placeholder: "700 123 456" },
  { code: "KZ", name: "Казахстан", dial: "+7", flag: "🇰🇿", maxLength: 10, placeholder: "700 123 4567" },
  { code: "BY", name: "Беларусь", dial: "+375", flag: "🇧🇾", maxLength: 9, placeholder: "29 123 4567" },
];

function formatNationalNumber(dial: string, digits: string) {
  const clean = digits.replace(/\D/g, "");
  if (dial === "+992" || dial === "+998" || dial === "+375") {
    // 9 цифр: XX XXX XXXX -> 93 123 4567
    const parts: string[] = [];
    if (clean.length > 0) parts.push(clean.slice(0, 2));
    if (clean.length > 2) parts.push(clean.slice(2, 5));
    if (clean.length > 5) parts.push(clean.slice(5, 9));
    return parts.join(" ");
  }
  if (dial === "+7") {
    // 10 цифр: XXX XXX XXXX
    const parts: string[] = [];
    if (clean.length > 0) parts.push(clean.slice(0, 3));
    if (clean.length > 3) parts.push(clean.slice(3, 6));
    if (clean.length > 6) parts.push(clean.slice(6, 10));
    return parts.join(" ");
  }
  // fallback: группы по 3
  return clean.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "+992",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [devCode, setDevCode] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countryCode, setCountryCode] = useState("TJ");

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCountryChange = (nextCode: string) => {
    const next = COUNTRIES.find((c) => c.code === nextCode) ?? COUNTRIES[0];
    setCountryCode(next.code);
    // При смене страны подставляем её код, национальную часть сбрасываем
    setForm((current) => ({ ...current, phone: next.dial }));
  };

  const handlePhoneChange = (raw: string) => {
    // Убираем код страны из ввода, оставляем только национальные цифры
    let rest = raw;
    if (rest.startsWith(selectedCountry.dial)) {
      rest = rest.slice(selectedCountry.dial.length);
    }
    // Если пользователь вставил полный номер с другим кодом — пробуем определить страну
    const digitsOnly = rest.replace(/\D/g, "");
    const fullDigits = raw.replace(/\D/g, "");
    for (const c of COUNTRIES) {
      const dialDigits = c.dial.replace(/\D/g, "");
      if (fullDigits.startsWith(dialDigits) && c.code !== countryCode) {
        const national = fullDigits.slice(dialDigits.length).slice(0, c.maxLength);
        setCountryCode(c.code);
        setForm((current) => ({
          ...current,
          phone: `${c.dial}${national ? ` ${formatNationalNumber(c.dial, national)}` : ""}`,
        }));
        return;
      }
    }
    const nationalDigits = digitsOnly.slice(0, selectedCountry.maxLength);
    const formatted = formatNationalNumber(selectedCountry.dial, nationalDigits);
    setForm((current) => ({
      ...current,
      phone: nationalDigits ? `${selectedCountry.dial} ${formatted}` : selectedCountry.dial,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json() as {
        token?: string; autoLogin?: boolean; user?: { role?: string };
        requiresVerification?: boolean; message?: string; error?: string; devCode?: string;
      };
      if (!response.ok) throw new Error(result.error || "Не удалось зарегистрироваться.");
      // П.1: АВТО-АВТОРИЗАЦИЯ — сервер уже создал JWT и поставил cookie.
      // Сохраняем Bearer и ведём на /admin или /account по роли, без /login.
      if (result.autoLogin && result.token) {
        localStorage.setItem("hasi-token", result.token);
        window.dispatchEvent(new Event("hasi-auth-changed"));
        router.push(result.user?.role === "ADMIN" ? "/admin" : "/account");
        return;
      }
      if (result.requiresVerification) setVerificationRequired(true);
      setVerificationRequired(Boolean(result.requiresVerification));
      setNotice(result.message || "Введите код из письма для подтверждения email.");
      setDevCode(result.devCode || "");
      if (result.devCode) setCode(result.devCode);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось зарегистрироваться.");
    } finally {
      setLoading(false);
    }
  };

  async function verifyEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code }),
      });
      const result = await response.json() as { token?: string; user?: { role?: string }; message?: string; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error || "Не удалось подтвердить email.");
      // П.1: авто-вход после подтверждения — редирект по роли, не на /login.
      localStorage.setItem("hasi-token", result.token);
      window.dispatchEvent(new Event("hasi-auth-changed"));
      router.push(result.user?.role === "ADMIN" ? "/admin" : "/account");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось подтвердить email.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const result = await response.json() as { message?: string; error?: string; devCode?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось отправить код.");
      setNotice(result.message || "Код отправлен.");
      setDevCode(result.devCode || "");
      if (result.devCode) setCode(result.devCode);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить код.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:p-10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Регистрация</p>
            <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Создать аккаунт HASI.TJ</h1>
          </div>

          {verificationRequired ? (
            <form onSubmit={verifyEmail} className="space-y-5">
              <p className="text-sm text-slate-600 dark:text-slate-300">Введите шестизначный код, отправленный на {form.email}.</p>
              <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} aria-label="Код подтверждения" placeholder="Код из письма" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
              {notice ? <p role="status" className="text-sm text-emerald-600">{notice}</p> : null}
              {devCode ? <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Тестовый код подтверждения: <strong className="font-mono text-lg tracking-widest">{devCode}</strong></p> : null}
              <div className="flex flex-wrap gap-3">
                <button disabled={loading} className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? "Проверяем…" : "Подтвердить email"}</button>
                <button type="button" disabled={loading} onClick={() => void resendCode()} className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold disabled:opacity-60 dark:border-slate-700">Отправить код повторно</button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Имя</label>
              <input value={form.firstName} onChange={(event) => handleChange("firstName", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Фамилия</label>
              <input value={form.lastName} onChange={(event) => handleChange("lastName", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <input type="email" value={form.email} onChange={(event) => handleChange("email", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="register-phone" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Номер телефона</label>
              <div className="flex gap-2">
                <div className="relative shrink-0">
                  <select
                    id="register-country"
                    aria-label="Страна"
                    value={countryCode}
                    onChange={(event) => handleCountryChange(event.target.value)}
                    className="h-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-3 pr-8 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.dial}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <input
                  id="register-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder={`${selectedCountry.dial} ${selectedCountry.placeholder}`}
                  value={form.phone}
                  onChange={(event) => handlePhoneChange(event.target.value)}
                  className="w-full min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 tracking-wide dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.dial}) — введите {selectedCountry.maxLength} цифр номера
              </p>
            </div>
            <div>
              <label htmlFor="register-password" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Пароль</label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={form.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  placeholder="Минимум 8 символов"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="register-confirm" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Подтвердите пароль</label>
              <div className="relative">
                <input
                  id="register-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={form.confirmPassword}
                  onChange={(event) => handleChange("confirmPassword", event.target.value)}
                  placeholder="Повторите пароль"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error ? <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}

            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="submit" disabled={loading} className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-70">
                {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
              </button>
              <Link href="/login" className="text-sm text-violet-600 hover:text-violet-500 dark:text-violet-300">Уже есть аккаунт? Войти</Link>
            </div>
          </form>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
