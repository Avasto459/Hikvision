import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { deleteAdminUser, findFallbackAdminByEmail, getUserByEmail, getUserByPhone, getUserById, StoreError, updateAdminUser, type UserRole } from "@/lib/db";
import { isPrimaryAdminEmail } from "@/lib/jwt-secret";
import { verifyToken } from "@/lib/auth";
import { normalizeTajikPhone } from "@/lib/phone";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json() as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      role?: UserRole;
      isBlocked?: number | boolean;
    };
    const current = await getUserById(id);
    if (!current) throw new StoreError("Пользователь не найден.", 404);

    const update: Parameters<typeof updateAdminUser>[2] = {};
    if (body.firstName !== undefined) {
      if (typeof body.firstName !== "string" || !body.firstName.trim() || body.firstName.length > 100) {
        throw new StoreError("Имя обязательно и не должно превышать 100 символов.", 400);
      }
      update.firstName = body.firstName.trim();
    }
    if (body.lastName !== undefined) {
      if (typeof body.lastName !== "string" || !body.lastName.trim() || body.lastName.length > 100) {
        throw new StoreError("Фамилия обязательна и не должна превышать 100 символов.", 400);
      }
      update.lastName = body.lastName.trim();
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || body.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        throw new StoreError("Укажите корректный email.", 400);
      }
      const email = body.email.trim().toLowerCase();
      const duplicate = await getUserByEmail(email);
      if (duplicate && duplicate.id !== id) throw new StoreError("Пользователь с таким Email уже зарегистрирован.", 409);
      update.email = email;
    }
    if (body.phone !== undefined) {
      const phone = typeof body.phone === "string" ? normalizeTajikPhone(body.phone) : null;
      if (!phone) throw new StoreError("Укажите телефон в формате +992XXXXXXXXX.", 400);
      const duplicate = await getUserByPhone(phone);
      if (duplicate && duplicate.id !== id) throw new StoreError("Этот телефон уже используется.", 409);
      update.phone = phone;
    }
    if (body.role !== undefined) {
      if (body.role !== "USER" && body.role !== "ADMIN" && body.role !== "DEALER" && body.role !== "DISTRIBUTOR") throw new StoreError("Недопустимая роль пользователя.", 400);
      update.role = body.role;
    }
    if (body.isBlocked !== undefined) {
      if (body.isBlocked !== 0 && body.isBlocked !== 1 && typeof body.isBlocked !== "boolean") {
        throw new StoreError("Недопустимый статус пользователя.", 400);
      }
      update.isBlocked = body.isBlocked === true || body.isBlocked === 1 ? 1 : 0;
    }
    const user = await updateAdminUser(id, actor.id, update);
    if (!user) throw new StoreError("Пользователь не найден.", 404);
    return NextResponse.json({ user: {
      id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone,
      role: user.role, emailVerified: user.emailVerified, isBlocked: user.isBlocked, createdAt: user.createdAt,
    } });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Admin user update failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось изменить пользователя." }, {
      status: error instanceof StoreError ? error.status : 409,
    });
  }
}

/** Локальная проверка админа: кука hasi-session или Authorization: Bearer. */
async function getAdminActor(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieToken = /(?:^|;\s*)hasi-session=([^;]+)/.exec(cookieHeader)?.[1] || null;
  const bearer = /Bearer\s+(.+)/.exec(request.headers.get("authorization") || "");
  const token = (bearer ? bearer[1] : null) || cookieToken;
  if (!token) throw new StoreError("Необходим вход в аккаунт.", 401);
  const user = verifyToken(token);
  const currentUser = await getUserById(user.id);
  if (!currentUser && user.id.startsWith("fallback-") && user.role === "ADMIN") {
    const fallback = await findFallbackAdminByEmail(user.email);
    if (fallback) return fallback;
  }
  if (!currentUser && user.role === "ADMIN" && isPrimaryAdminEmail(user.email)) {
    return { id: user.id, firstName: "", lastName: "", phone: "", email: user.email.toLowerCase(), passwordHash: "", emailVerified: 0, isBlocked: 0, role: "ADMIN" as UserRole, createdAt: new Date().toISOString() };
  }
  if (!currentUser) throw new StoreError("Сессия недействительна.", 401);
  if (isPrimaryAdminEmail(currentUser.email)) currentUser.role = "ADMIN";
  if (currentUser.isBlocked) throw new StoreError("Учётная запись заблокирована. Свяжитесь с магазином.", 403);
  if (currentUser.role !== "ADMIN") throw new StoreError("Недостаточно прав.", 403);
  return currentUser;
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const actor = await getAdminActor(request);
    const { id } = await params;
    if (!id || id.length > 100) throw new StoreError("Некорректный идентификатор пользователя.", 400);
    await deleteAdminUser(id, actor.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && !(error instanceof StoreError)) console.error("Admin user deletion failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось удалить пользователя." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
