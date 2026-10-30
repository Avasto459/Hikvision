import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { StoreError } from "@/lib/db";

const MAX_FILE = 10 * 1024 * 1024;
const formats = {
  "image/jpeg": { extension: "jpg", matches: (d: Buffer) => d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff },
  "image/png": { extension: "png", matches: (d: Buffer) => d.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: "webp", matches: (d: Buffer) => d.toString("ascii", 0, 4) === "RIFF" && d.toString("ascii", 8, 12) === "WEBP" },
} as const;

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", қ: "q", ғ: "g", ӣ: "i", ӯ: "u", ҳ: "h", ҷ: "j",
};

/** Slug из названия (кириллица → латиница) + короткий суффикс, чтобы он всегда был уникальным. */
export function makeSlug(name: string) {
  const base = name.toLowerCase().split("").map((ch) => CYR[ch] ?? ch).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${base || "product"}-${randomUUID().slice(0, 6)}`;
}

/** Проверяет файлы (размер, тип, сигнатура) и только потом сохраняет в public/uploads/products. Возвращает пути. */
export async function saveProductImages(files: File[]): Promise<string[]> {
  const checked: { data: Buffer; extension: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE) throw new StoreError("Размер каждой фотографии — не более 10 МБ.", 413);
    const format = formats[file.type as keyof typeof formats];
    if (!format) throw new StoreError("Поддерживаются только фотографии JPEG, PNG и WebP.", 400);
    const data = Buffer.from(await file.arrayBuffer());
    if (!format.matches(data)) throw new StoreError("Содержимое фотографии не соответствует её формату.", 400);
    checked.push({ data, extension: format.extension });
  }
  const saved: string[] = [];
  if (checked.length) {
    const folder = path.join(process.cwd(), "public", "uploads", "products");
    await mkdir(folder, { recursive: true });
    for (const { data, extension } of checked) {
      const filename = `${randomUUID()}.${extension}`;
      await writeFile(path.join(folder, filename), data, { flag: "wx" });
      saved.push(`/uploads/products/${filename}`);
    }
  }
  return saved;
}
