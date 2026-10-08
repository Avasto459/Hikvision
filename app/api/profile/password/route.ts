import { NextResponse } from "next/server";
import { comparePassword, hashPassword } from "@/lib/auth";
import { getUserById, StoreError, updateAccountPassword } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";

export async function PUT(request: Request) {
  try {
    const userId = (await requireUser(request)).id;
    const user = await getUserById(userId);
    if (!user) throw new StoreError("Пользователь не найден.", 404);
    const body = await request.json() as { currentPassword?: string; password?: string; confirmPassword?: string };
    if (!body.currentPassword || !body.password || body.password.length < 8 || body.password.length > 128) {
      throw new StoreError("Введите текущий пароль и новый пароль не короче 8 символов.", 400);
    }
    if (body.password !== body.confirmPassword) throw new StoreError("Пароли не совпадают.", 400);
    if (!await comparePassword(body.currentPassword, user.passwordHash)) throw new StoreError("Текущий пароль указан неверно.", 401);
    await updateAccountPassword(userId, await hashPassword(body.password));
    return NextResponse.json({ success: true, message: "Пароль обновлён." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось обновить пароль." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
