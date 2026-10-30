import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";

export const runtime = "nodejs";

const maxFileSize = 10 * 1024 * 1024;
const formats = {
  "image/jpeg": { extension: "jpg", matches: (data: Buffer) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/png": { extension: "png", matches: (data: Buffer) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: "webp", matches: (data: Buffer) => data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP" },
} as const;

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 6 * maxFileSize + 64 * 1024) {
      throw new StoreError("Суммарный размер фотографий превышает лимит 60 МБ.", 413);
    }

    const form = await request.formData();
    const files = form.getAll("images").filter((value): value is File => value instanceof File);
    if (!files.length || files.length > 6) throw new StoreError("Выберите от 1 до 6 фотографий.", 400);

    const folder = path.join(process.cwd(), "public", "uploads", "products");
    await mkdir(folder, { recursive: true });
    const images: string[] = [];
    for (const file of files) {
      if (file.size === 0 || file.size > maxFileSize) {
        throw new StoreError("Размер каждой фотографии должен быть от 1 байта до 10 МБ.", 413);
      }
      const format = formats[file.type as keyof typeof formats];
      if (!format) throw new StoreError("Поддерживаются только фотографии JPEG, PNG и WebP.", 400);

      const data = Buffer.from(await file.arrayBuffer());
      if (!format.matches(data)) throw new StoreError("Содержимое фотографии не соответствует её формату.", 400);

      const filename = `${randomUUID()}.${format.extension}`;
      await writeFile(path.join(folder, filename), data, { flag: "wx" });
      images.push(`/uploads/products/${filename}`);
    }
    return NextResponse.json({ images }, { status: 201 });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Product image upload failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить фотографии." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
