import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";
import { deleteThread, getAdminThread, postAdminReply } from "@/lib/chat";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function fail(error: unknown, fallback: string) {
  if (error && !(error instanceof StoreError)) console.error("Admin chat error:", error);
  return NextResponse.json({ error: error instanceof StoreError ? error.message : fallback }, { status: error instanceof StoreError ? error.status : 500 });
}

/** GET — история переписки (открытие помечает её прочитанной). */
export async function GET(request: Request, { params }: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await getAdminThread(id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error, "Не удалось загрузить переписку."); }
}

/** POST { text } — ответ администратора; посетитель увидит его при ближайшем опросе. */
export async function POST(request: Request, { params }: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    let body: { text?: string } = {};
    try { body = (await request.json()) as typeof body; } catch { throw new StoreError("Некорректный запрос.", 400); }
    return NextResponse.json({ success: true, message: await postAdminReply(id, String(body.text ?? "")) }, { status: 201 });
  } catch (error) { return fail(error, "Не удалось отправить ответ."); }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await deleteThread(id);
    return NextResponse.json({ success: true });
  } catch (error) { return fail(error, "Не удалось удалить переписку."); }
}
