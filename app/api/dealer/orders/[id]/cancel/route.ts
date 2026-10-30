import { cancelOrderByDealer } from "@/lib/hasi";
import { requireDealer, respond } from "@/lib/hasi-api";

/**
 * Дилер отменяет свой заказ.
 * «Принята дилером» → «Отменена». «Товар выдан» → «Возврат на проверке» (склад подтверждает возврат).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const dealer = await requireDealer(request);
    const { id } = await ctx.params;
    const result = await cancelOrderByDealer(dealer.id, id);
    return {
      success: true,
      ...result,
      message: result.status === "cancelled"
        ? `Заказ ${result.orderNumber} отменён.`
        : `Возврат по заказу ${result.orderNumber} запрошен. Верните товар на склад — администратор подтвердит возврат.`,
    };
  });
}
