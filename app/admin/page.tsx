"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";

/** Главный админ — доступ гарантируется даже при недоступности БД. */
const PRIMARY_ADMIN_EMAIL = "najmiddinovavasto5@gmail.com";

/** П.3: клиентский JWT-fallback — декодируем payload без обращения к БД. */
function decodeJwtPayload(token: string): { id?: unknown; email?: unknown; role?: unknown; exp?: unknown } | null {
  try {
    const segment = token.split(".")[1] || "";
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded)) as { id?: unknown; email?: unknown; role?: unknown; exp?: unknown };
  } catch {
    return null;
  }
}

/** Роль из токена; главному админу роль ADMIN присваивается автоматически (П.2). */
function roleFromToken(token: string): "ADMIN" | "USER" | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.email !== "string") return null;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
  // П.4: email главного админа ИЛИ role admin => беспрепятственный доступ.
  if (payload.email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL) return "ADMIN";
  return payload.role === "ADMIN" ? "ADMIN" : payload.role === "USER" ? "USER" : null;
}

/** Email из токена без обращения к БД (П.4 — JWT-fallback). */
function emailFromToken(token: string): string {
  const payload = decodeJwtPayload(token);
  return typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
}

type Gate = "checking" | "allowed" | "denied" | "error";

const CHECK_TIMEOUT_MS = 10000;

export default function AdminPage() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("checking");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("hasi-token");
    if (!token) {
      router.replace("/login?next=/admin");
      return;
    }

    // Главный админ или роль ADMIN в JWT — доступ сразу, без ожидания БД (сервер всё равно проверяет права в каждом API).
    if (roleFromToken(token) === "ADMIN" || emailFromToken(token) === PRIMARY_ADMIN_EMAIL) {
      setGate("allowed");
      return;
    }

    // Запрос с таймаутом: без него зависший /api/profile оставлял вечный прелоадер.
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    let active = true;
    setGate("checking");

    (async () => {
      try {
        const response = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { user?: { email?: unknown; role?: unknown }; error?: string };
        if (!active) return;
        if (response.status === 401) {
          localStorage.removeItem("hasi-token");
          router.replace("/login?next=/admin");
          return;
        }
        if (!response.ok) throw new Error(data.error || "Не удалось проверить права доступа.");
        const email = typeof data.user?.email === "string" ? data.user.email.trim().toLowerCase() : "";
        if (data.user?.role === "ADMIN" || email === PRIMARY_ADMIN_EMAIL) setGate("allowed");
        else { setGate("denied"); setMessage("У вашей учётной записи нет прав администратора."); }
      } catch (reason) {
        if (!active) return;
        setGate("error");
        setMessage(reason instanceof DOMException && reason.name === "AbortError"
          ? "Сервер не ответил за 10 секунд. Проверьте соединение и повторите попытку."
          : reason instanceof Error ? reason.message : "Не удалось проверить права доступа.");
      } finally {
        window.clearTimeout(timer);
      }
    })();

    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [router, attempt]);

  if (gate === "checking") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-5xl px-4 py-16 text-slate-500">Проверка прав администратора…</div>;
  }

  if (gate !== "allowed") {
    return (
      <section className="mx-auto max-w-xl px-4 py-16">
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <h1 className="text-xl font-black">{gate === "denied" ? "Доступ запрещён" : "Не удалось проверить доступ"}</h1>
          <p className="mt-2 text-sm">{message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {gate === "error" ? <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white">Повторить</button> : null}
            <a href="/login?next=/admin" className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold">Войти другим аккаунтом</a>
            <a href="/" className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold">На главную</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-3 py-8 sm:px-6 sm:py-14 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Admin Panel</p>
        <h1 className="mt-2 break-words text-3xl font-black leading-tight sm:text-4xl text-slate-900 dark:text-white">Панель управления HASI.TJ</h1>
      </div>
      <AdminDashboard />
    </section>
  );
}
