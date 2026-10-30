import { NextResponse } from "next/server";
import { getCart, removeCartItem, setCartQuantity, StoreError } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";

async function authenticatedUser(request: Request) {
  return await requireUser(request);
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser(request);
    return NextResponse.json({ items: await getCart(user.id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить корзину." },
      { status: error instanceof StoreError ? error.status : 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await authenticatedUser(request);
    const body = await request.json() as { productId?: string; quantity?: number };
    if (!body.productId || !Number.isInteger(body.quantity) || (body.quantity as number) < 0) {
      throw new StoreError("Укажите товар и корректное количество.", 400);
    }
    await setCartQuantity(user.id, body.productId, body.quantity as number);
    return NextResponse.json({ items: await getCart(user.id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось обновить корзину." },
      { status: error instanceof StoreError ? error.status : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await authenticatedUser(request);
    const body = await request.json() as { productId?: string };
    if (!body.productId) throw new StoreError("Не указан товар.", 400);
    await removeCartItem(user.id, body.productId);
    return NextResponse.json({ items: await getCart(user.id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось удалить товар." },
      { status: error instanceof StoreError ? error.status : 500 },
    );
  }
}
