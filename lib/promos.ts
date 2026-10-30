import { db } from "@/lib/db/db";
import { initializeSchema } from "@/lib/db/schema";

export type Promo = {
  id: string;
  title: string;
  subtitle: string;
  discountPercent: number;
  image: string;
  href: string;
  endsAt: string | null;
  sort: number;
  isActive: number;
  createdAt: string;
};

function mapPromo(x: Record<string, unknown>): Promo {
  return {
    id: String(x.id), title: String(x.title), subtitle: String(x.subtitle || ""), discountPercent: Number(x.discountPercent || 0),
    image: String(x.image || ""), href: String(x.href || ""), endsAt: x.endsAt ? String(x.endsAt) : null,
    sort: Number(x.sort || 0), isActive: Number(x.isActive ?? 1), createdAt: String(x.createdAt || ""),
  };
}

/** Баннеры для витрины: включённые и не истёкшие. Сбой базы не должен ломать главную. */
export async function getActivePromos(limit = 8): Promise<Promo[]> {
  try {
    await initializeSchema();
    const r = await db.execute({
      sql: `SELECT * FROM promos WHERE isActive=1 AND (endsAt IS NULL OR datetime(endsAt) > datetime('now')) ORDER BY sort ASC, datetime(createdAt) DESC LIMIT ?`,
      args: [limit],
    });
    return r.rows.map((x) => mapPromo(x as Record<string, unknown>));
  } catch (error) {
    console.error("Promos:", error);
    return [];
  }
}
