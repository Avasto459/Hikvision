import { createDealer, getDefaultLimit, getHasiTotals, listDealersAdmin } from "@/lib/hasi";
import { readDealerRequest, requireAdmin, respond } from "@/lib/hasi-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return respond(async () => {
    await requireAdmin(request);
    const [dealers, defaultLimit, totals] = await Promise.all([listDealersAdmin(), getDefaultLimit(), getHasiTotals()]);
    return { dealers, defaultLimit, totals };
  }, 200, { "Cache-Control": "private, no-store, no-cache, must-revalidate" });
}

/**
 * POST — создать дилера. JSON или multipart (data + passportScan).
 * data: { name, email, phone?, password, status?, limit?, identity:{ fullName, passportNumber, birthDate?, issuedBy?, issueDate?, registrationAddress?, notes? } }
 */
export async function POST(request: Request) {
  return respond(async () => {
    const admin = await requireAdmin(request);
    const { data: b, scans } = await readDealerRequest<{
      name?: string; email?: string; phone?: string; password?: string; status?: string; limit?: number | null;
      identity?: { fullName: string; passportNumber: string; birthDate?: string; issuedBy?: string; issueDate?: string; registrationAddress?: string; notes?: string };
    }>(request);
    const id = await createDealer(admin.id, {
      name: String(b.name ?? ""), email: String(b.email ?? ""), phone: b.phone, password: String(b.password ?? ""),
      status: b.status, limit: b.limit === undefined || b.limit === null ? undefined : Number(b.limit),
      identity: b.identity ?? { fullName: "", passportNumber: "" },
      scans,
    });
    const dealers = await listDealersAdmin();
    return { success: true, id, dealers };
  }, 201);
}
