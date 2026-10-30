/**
 * Роли по ТЗ 0.1: Admin, Distributor, Dealer, Customer.
 * Покупатель (Customer) аккаунта не имеет и оформляет заказ без входа;
 * "USER" оставлен только для уже существующих учётных записей магазина.
 * Файл edge-safe (без БД) — его можно импортировать и в proxy.ts.
 */
export const APP_ROLES = ["USER", "ADMIN", "DISTRIBUTOR", "DEALER"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

/** Куда вести пользователя после входа. */
export function dashboardPathForRole(role?: string | null): string {
  switch (String(role ?? "").toUpperCase()) {
    case "ADMIN": return "/admin";
    // Дилер и дистрибьютор после входа попадают в каталог /distributor/catalog.
    case "DEALER":
    case "DISTRIBUTOR": return "/distributor/catalog";
    default: return "/customer/dashboard";
  }
}

/** Какие роли допускаются на префикс пути (используется в proxy.ts). */
export function requiredRolesForPath(pathname: string): AppRole[] | null {
  if (pathname === "/dealer" || pathname.startsWith("/dealer/")) return ["DEALER"];
  if (pathname === "/distributor" || pathname.startsWith("/distributor/")) return ["DISTRIBUTOR", "DEALER"];
  if (pathname === "/customer" || pathname.startsWith("/customer/")) return ["USER"];
  return null;
}
