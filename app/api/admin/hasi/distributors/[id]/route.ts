import { deleteDistributor, updateDistributor } from "@/lib/hasi";
import { readJson, requireAdmin, respond } from "@/lib/hasi-api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** PATCH — изменить название, email, телефон, статус (active|blocked) или пароль. */
export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    await requireAdmin(request);
    const { id } = await params;
    const b = await readJson<{ name?: string; email?: string; phone?: string; password?: string; status?: string }>(request);
    const distributor = await updateDistributor(id, {
      name: b.name === undefined ? undefined : String(b.name),
      email: b.email === undefined ? undefined : String(b.email),
      phone: b.phone === undefined ? undefined : String(b.phone),
      password: b.password ? String(b.password) : undefined,
      status: b.status === undefined ? undefined : String(b.status),
    });
    return { success: true, distributor };
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  return respond(async () => {
    await requireAdmin(request);
    const { id } = await params;
    await deleteDistributor(id);
    return { success: true };
  });
}
