"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
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

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("hasi-token");
    if (!token) {
      router.replace("/login");
      return;
    }

    // П.4: email главного админа ИЛИ role admin в JWT => доступ сразу,
    // без ожидания БД и без ошибок «Сессия недействительна».
    if (roleFromToken(token) === "ADMIN" || emailFromToken(token) === PRIMARY_ADMIN_EMAIL) {
      setAllowed(true);
      setLoading(false);
      return;
    }

    fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          // П.4: БД недоступна для чтения сессии — валидируем JWT напрямую.
          // Главный админ (email) или role admin проходят без ошибок.
          if (roleFromToken(token) === "ADMIN" || emailFromToken(token) === PRIMARY_ADMIN_EMAIL) {
            setAllowed(true);
            return;
          }
          throw new Error(data.error || "Не удалось получить доступ");
        }
        // П.4: email главного админа ИЛИ role admin => доступ.
        const email = typeof data.user?.email === "string" ? data.user.email.trim().toLowerCase() : "";
        const role = email === PRIMARY_ADMIN_EMAIL ? "ADMIN" : data.user?.role;
        if (role !== "ADMIN" && email !== PRIMARY_ADMIN_EMAIL) {
          throw new Error("Доступ запрещён");
        }
        setAllowed(true);
      })
      .catch((reason) => {
        // Server proxy already redirects non-admins; this is a second line of defence.
        router.replace(String(reason?.message || "").includes("Доступ запрещён") ? "/account" : "/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <SiteShell><div className="mx-auto max-w-5xl px-4 py-16 text-slate-500">Проверка прав администратора...</div></SiteShell>;
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Admin Panel</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Панель управления HASI.TJ</h1>
        </div>
        {allowed ? <AdminDashboard /> : <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">Доступ запрещён</div>}
      </section>
    </SiteShell>
  );
}