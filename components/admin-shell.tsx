"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Inbox, LayoutDashboard, MessageCircle, Package, Truck, Users } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/admin", label: "Админ-панель", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Заявки", icon: Inbox },
  { href: "/admin/dealers", label: "Дилеры", icon: ClipboardList },
  { href: "/admin/distributors", label: "Дистрибьюторы", icon: Truck },
  { href: "/admin/catalog", label: "Каталог", icon: Package },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/messages", label: "Сообщения", icon: MessageCircle },
] as const;

/**
 * Самостоятельный макет админки: собственная шапка, без публичного меню,
 * поиска, корзины, подвала и мобильной навигации магазина.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" aria-label="HASI — админ-панель" className="flex shrink-0 items-center gap-3">
            <span className="rounded-xl bg-white px-2 py-1 ring-1 ring-slate-200 dark:ring-slate-700">
              <Image src="/hasi-logo.png" alt="HASI" width={600} height={370} priority className="h-8 w-auto" />
            </span>
            <span className="hidden rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700 sm:inline dark:bg-violet-500/15 dark:text-violet-300">Admin</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
        <nav aria-label="Меню администратора" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 text-sm font-semibold sm:px-6 lg:px-8">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 transition ${active ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "text-slate-600 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
