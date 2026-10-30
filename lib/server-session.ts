import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { getAccountById, type AccountUser } from "@/lib/partners";
import { dashboardPathForRole, type AppRole } from "@/lib/roles";

/**
 * Серверная проверка роли на страницах (второй рубеж после proxy.ts).
 * Роль и блокировка берутся из БД, а не из токена: смена роли действует сразу.
 */
export async function requireRole(roleOrRoles: AppRole | AppRole[]): Promise<AccountUser> {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  // Cookie нельзя менять во время рендера, поэтому битую/устаревшую сессию сбрасывает
  // route handler: иначе proxy.ts (видит валидную подпись) гонял бы /login ↔ страница бесконечно.
  const reset = (next: string): never => redirect(`/api/auth/reset-session?next=${encodeURIComponent(next)}`);

  if (!session) {
    if (token) reset(`/login?next=${encodeURIComponent(dashboardPathForRole(roles[0]))}`);
    redirect(`/login?next=${encodeURIComponent(dashboardPathForRole(roles[0]))}`);
  }

  const user = await getAccountById(session.id);
  // Аккаунт удалён/заблокирован: токен ещё валиден, но входить с ним нельзя.
  if (!user || user.isBlocked) return reset("/login");
  // Роль в БД изменилась, а в токене старая: proxy пускает по токену, поэтому без сброса был бы цикл.
  if (!roles.includes(user.role as AppRole)) return reset("/login");
  return user;
}
