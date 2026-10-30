import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";
import { createAdminUser, StoreError } from "@/lib/db";

/**
 * POST /api/admin/users/create — { name, email, password }
 * Доступ только у авторизованного, не заблокированного пользователя с ролью ADMIN:
 * роль проверяется по базе (requireAdmin), а не по содержимому токена.
 * Пароль хэшируется bcrypt, новому пользователю назначается role = "ADMIN".
 */
export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    let body: { name?: unknown; email?: unknown; password?: unknown };
    try {
      body = await request.json() as typeof body;
    } catch {
      throw new StoreError("Некорректный запрос.", 400);
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || name.length > 100) throw new StoreError("Укажите имя (до 100 символов).", 400);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError("Укажите корректный email.", 400);
    if (password.length < 10 || password.length > 128) throw new StoreError("Пароль администратора — от 10 до 128 символов.", 400);

    const user = await createAdminUser({ name, email, passwordHash: await hashPassword(password) }, actor.id);
    return NextResponse.json({
      success: true,
      message: "Администратор создан.",
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, createdAt: user.createdAt },
    }, { status: 201 });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Admin creation failed:", error);
    return NextResponse.json({ error: error instanceof StoreError ? error.message : "Не удалось создать администратора." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
