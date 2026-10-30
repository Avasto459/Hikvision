import { requireUser } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";
import { respond } from "@/lib/hasi-api";
import { parseCatalogQuery, partnerCatalog } from "@/lib/partner-catalog";

export const dynamic = "force-dynamic";

/** GET /api/partner/catalog?q=&brand=&category=&sort=&inStock=1&offset=&limit= — каталог для дилера, дистрибьютора и админа. */
export async function GET(request: Request) {
  return respond(async () => {
    const user = await requireUser(request);
    if (user.role !== "DEALER" && user.role !== "DISTRIBUTOR" && user.role !== "ADMIN") throw new StoreError("Недостаточно прав.", 403);
    return partnerCatalog.search(parseCatalogQuery(new URL(request.url).searchParams));
  });
}
