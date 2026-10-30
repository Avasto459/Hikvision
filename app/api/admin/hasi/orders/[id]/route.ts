import { StoreError } from "@/lib/db";
import { cancelOrderAdmin, deleteOrderAdmin } from "@/lib/hasi";
import { readJson, requireAdmin, respond } from "@/lib/hasi-api";

/**
 * POST { action: "cancel" } — отменить заказ (выданный товар возвращается на склад, лимит дилера освобождается).
 * Тот же вызов подтверждает возврат, запрошенный дилером.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    const b = await readJson<{ action?: string }>(request);
    if (b.action !== "cancel") throw new StoreError("Укажите действие: cancel.", 400);
    const { returned } = await cancelOrderAdmin(admin.id, id);
    return { success: true, returned };
  });
}

/** DELETE — полностью удалить заказ из базы (очистка тестовых заявок). */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const admin = await requireAdmin(request);
    const { id } = await ctx.params;
    await deleteOrderAdmin(admin.id, id);
    return { success: true };
  });
}
