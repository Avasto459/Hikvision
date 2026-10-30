"use client";

import { useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

export type Country = {
  code: string;
  name: string;
  dial: string;
  flag: string;
  maxLength: number;
  placeholder: string;
};

export const COUNTRIES: Country[] = [
  { code: "TJ", name: "Таджикистан", dial: "+992", flag: "🇹🇯", maxLength: 9, placeholder: "93 123 4567" },
  { code: "RU", name: "Россия", dial: "+7", flag: "🇷🇺", maxLength: 10, placeholder: "900 123 4567" },
  { code: "UZ", name: "Узбекистан", dial: "+998", flag: "🇺🇿", maxLength: 9, placeholder: "90 123 4567" },
  { code: "KG", name: "Кыргызстан", dial: "+996", flag: "🇰🇬", maxLength: 9, placeholder: "700 123 456" },
  { code: "KZ", name: "Казахстан", dial: "+7", flag: "🇰🇿", maxLength: 10, placeholder: "700 123 4567" },
  { code: "BY", name: "Беларусь", dial: "+375", flag: "🇧🇾", maxLength: 9, placeholder: "29 123 4567" },
];

export function getCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}

export function formatNationalNumber(dial: string, digits: string) {
  const clean = digits.replace(/\D/g, "");
  if (dial === "+992" || dial === "+998" || dial === "+375" || dial === "+996") {
    const parts: string[] = [];
    if (clean.length > 0) parts.push(clean.slice(0, 2));
    if (clean.length > 2) parts.push(clean.slice(2, 5));
    if (clean.length > 5) parts.push(clean.slice(5, 9));
    return parts.join(" ");
  }
  if (dial === "+7") {
    const parts: string[] = [];
    if (clean.length > 0) parts.push(clean.slice(0, 3));
    if (clean.length > 3) parts.push(clean.slice(3, 6));
    if (clean.length > 6) parts.push(clean.slice(6, 10));
    return parts.join(" ");
  }
  return clean.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export function formatPhoneInput(raw: string, countryCode: string): { phone: string; countryCode: string } {
  const current = getCountry(countryCode);
  let rest = raw;
  if (rest.startsWith(current.dial)) rest = rest.slice(current.dial.length);
  const fullDigits = raw.replace(/\D/g, "");
  for (const c of COUNTRIES) {
    const dialDigits = c.dial.replace(/\D/g, "");
    if (fullDigits.startsWith(dialDigits) && c.code !== countryCode) {
      const national = fullDigits.slice(dialDigits.length).slice(0, c.maxLength);
      return {
        countryCode: c.code,
        phone: national ? `${c.dial} ${formatNationalNumber(c.dial, national)}` : c.dial,
      };
    }
  }
  const nationalDigits = rest.replace(/\D/g, "").slice(0, current.maxLength);
  return {
    countryCode,
    phone: nationalDigits ? `${current.dial} ${formatNationalNumber(current.dial, nationalDigits)}` : current.dial,
  };
}

export const authInputBase =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-violet-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

type PasswordInputProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

/** Поле пароля с иконкой «глаз» справа (Eye / EyeOff из lucide-react). */
export function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
  required = true,
  minLength = 8,
  maxLength = 128,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${authInputBase} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          title={visible ? "Скрыть пароль" : "Показать пароль"}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

type PhoneInputProps = {
  id?: string;
  label?: string;
  value: string;
  countryCode: string;
  onChange: (phone: string) => void;
  onCountryChange: (code: string) => void;
  required?: boolean;
  hint?: boolean;
};

/** Поле телефона с селектором страны (флаг + dial-код), по умолчанию — Таджикистан +992. */
export function PhoneInput({
  id = "phone",
  label = "Номер телефона",
  value,
  countryCode,
  onChange,
  onCountryChange,
  required = true,
  hint = true,
}: PhoneInputProps) {
  const selected = getCountry(countryCode);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <select
            aria-label="Код страны"
            value={selected.code}
            onChange={(event) => {
              const next = getCountry(event.target.value);
              onCountryChange(next.code);
              onChange(next.dial);
            }}
            className="h-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-3 pr-8 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
          id={id}
          type="tel"
          required={required}
          autoComplete="tel"
          inputMode="tel"
          placeholder={`${selected.dial} ${selected.placeholder}`}
          value={value}
          onChange={(event) => {
            const next = formatPhoneInput(event.target.value, selected.code);
            if (next.countryCode !== selected.code) onCountryChange(next.countryCode);
            onChange(next.phone);
          }}
          className={`${authInputBase} min-w-0 flex-1 tracking-wide`}
        />
      </div>
      {hint ? (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {selected.flag} {selected.name} ({selected.dial}) — введите {selected.maxLength} цифр номера
        </p>
      ) : null}
    </div>
  );
}

