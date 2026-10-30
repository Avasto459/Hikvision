import { NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";
import { MAX_SCAN_BYTES, validateScan, type PassportScans } from "@/lib/hasi";

export { requireAdmin };

export async function requireDealer(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "DEALER") throw new StoreError("Раздел доступен только дилерам.", 403);
  return user;
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new StoreError("Некорректный запрос.", 400);
  }
}

/** Единый обработчик: StoreError → его статус, прочее → 500 без утечки деталей. */
export async function respond<T>(work: () => Promise<T>, status = 200, headers: Record<string, string> = {}) {
  try {
    return NextResponse.json(await work(), { status, headers });
  } catch (error) {
    if (error instanceof StoreError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error("HASI API error:", error);
    return NextResponse.json({ error: "Внутренняя ошибка. Повторите попытку позже." }, { status: 500, headers });
  }
}

/**
 * Тело запроса дилера: либо JSON, либо multipart/form-data
 * (поле `data` — JSON-строка с полями, поле `passportScan` — файл PNG/JPG/WEBP/PDF).
 */
export async function readDealerRequest<T extends Record<string, unknown>>(request: Request): Promise<{ data: T; scans: PassportScans }> {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("multipart/form-data")) return { data: await readJson<T>(request), scans: {} };

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new StoreError("Не удалось прочитать форму. Проверьте размер файлов (до 2 МБ каждый).", 400);
  }
  let data: T;
  try {
    data = JSON.parse(String(form.get("data") ?? "{}")) as T;
  } catch {
    throw new StoreError("Некорректные данные формы.", 400);
  }
  const scans: PassportScans = {};
  for (const [field, side] of [["passportScan", "front"], ["passportScanBack", "back"]] as const) {
    const file = form.get(field);
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_SCAN_BYTES) throw new StoreError("Файл скана больше 2 МБ — выберите файл поменьше.", 413);
      scans[side] = validateScan(new Uint8Array(await file.arrayBuffer()));
    }
  }
  return { data, scans };
}
