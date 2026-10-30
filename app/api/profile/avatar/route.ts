import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getPublicUser, getUserById, updateUserProfile, StoreError } from "@/lib/db";

export const runtime = "nodejs";

const maxAvatarSize = 2 * 1024 * 1024;
const avatarsPrefix = "/uploads/avatars/";
const formats = {
  "image/jpeg": { extension: "jpg", matches: (data: Buffer) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/png": { extension: "png", matches: (data: Buffer) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: "webp", matches: (data: Buffer) => data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP" },
} as const;

function avatarsFolder() {
  return path.join(process.cwd(), "public", "uploads", "avatars");
}

async function requireProfileOwner(request: Request) {
  return (await requireUser(request)).id;
}

/** Only removes files this module owns: `/uploads/avatars/<name>` without separators. */
async function removeManagedAvatar(avatar: string | null) {
  if (!avatar || !avatar.startsWith(avatarsPrefix)) return;
  const filename = avatar.slice(avatarsPrefix.length);
  if (!filename || filename.includes("/") || filename.includes("\\")) return;
  try {
    await unlink(path.join(avatarsFolder(), filename));
  } catch {
    // The file is already gone — the database still ends up consistent.
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireProfileOwner(request);
    const form = await request.formData();
    const file = form.get("avatar");
    if (!(file instanceof File)) throw new StoreError("Выберите фотографию профиля.", 400);
    if (file.size === 0 || file.size > maxAvatarSize) {
      throw new StoreError("Размер фотографии должен быть от 1 байта до 2 МБ.", 413);
    }
    const format = formats[file.type as keyof typeof formats];
    if (!format) throw new StoreError("Поддерживаются только фотографии JPEG, PNG и WebP.", 400);

    const data = Buffer.from(await file.arrayBuffer());
    if (!format.matches(data)) throw new StoreError("Содержимое фотографии не соответствует её формату.", 400);

    const folder = avatarsFolder();
    await mkdir(folder, { recursive: true });
    const previous = (await getUserById(userId))?.avatar ?? null;
    const filename = `${randomUUID()}.${format.extension}`;
    await writeFile(path.join(folder, filename), data, { flag: "wx" });

    await updateUserProfile(userId, { avatar: `${avatarsPrefix}${filename}` });
    await removeManagedAvatar(previous);

    const user = await getUserById(userId);
    if (!user) throw new StoreError("Пользователь не найден.", 404);
    return NextResponse.json({ user: getPublicUser(user) });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Profile photo upload failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить фотографию." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireProfileOwner(request);
    const current = await getUserById(userId);
    if (!current) throw new StoreError("Пользователь не найден.", 404);
    if (!current.avatar) throw new StoreError("Фотография профиля не загружена.", 404);

    await updateUserProfile(userId, { avatar: null });
    await removeManagedAvatar(current.avatar);

    const user = await getUserById(userId);
    if (!user) throw new StoreError("Пользователь не найден.", 404);
    return NextResponse.json({ user: getPublicUser(user) });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Profile photo removal failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось удалить фотографию." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
