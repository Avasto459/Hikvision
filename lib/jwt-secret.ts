/**
 * Единый источник JWT-секрета для всего приложения (auth, session cookie,
 * proxy, шифрование интеграций, админ-диагностика).
 *
 * Если JWT_SECRET не задан или короче 32 символов — используется fallback
 * длиннее 32 символов, чтобы вход, регистрация и сброс пароля работали
 * «из коробки». В production обязательно задайте собственный JWT_SECRET.
 *
 * Файл намеренно не импортирует ничего лишнего (bcrypt, БД), чтобы его
 * можно было безопасно использовать и в proxy.ts, и в lib/session.ts.
 */
export const FALLBACK_JWT_SECRET = "default_fallback_jwt_secret_key_32_characters_long_for_dev";

export const MIN_SECRET_LENGTH = 32;

/**
 * Главный администратор, которому гарантируется доступ к /admin
 * даже в read-only режиме БД на Vercel.
 * Константа живёт здесь (а не в lib/db.ts), потому что этот файл
 * edge-safe (без нативных модулей) и импортируется из proxy.
 */
export const PRIMARY_ADMIN_EMAIL = "najmiddinovavasto5@gmail.com";

/** true, если email совпадает с главным админом (без учёта регистра). */
export function isPrimaryAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

/** true, если в окружении задан корректный (≥32 символов) JWT_SECRET или NEXTAUTH_SECRET. */
export function hasCustomJwtSecret(): boolean {
  const candidates = [process.env.JWT_SECRET, process.env.NEXTAUTH_SECRET];
  return candidates.some((value) => Boolean(value && value.trim().length >= MIN_SECRET_LENGTH));
}

/** Эффективный секрет: JWT_SECRET (≥32) либо встроенный fallback. Никогда не бросает. */
export function getJwtSecret(): string {
  const candidates = [process.env.JWT_SECRET, process.env.NEXTAUTH_SECRET];
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length >= MIN_SECRET_LENGTH) return candidate.trim();
  }
  return FALLBACK_JWT_SECRET;
}
