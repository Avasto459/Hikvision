import { NextResponse } from "next/server";
import { addFavorite, getUserFavorites, removeFavorite, StoreError } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";

async function userId(request: Request) {
  return (await requireUser(request)).id;
}

export async function GET(request: Request) {
  try {
    return NextResponse.json({ products: await getUserFavorites(await userId(request)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить избранное." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}

export async function PUT(request: Request) {
  try {
    const uid = await userId(request);
    const body = await request.json() as { productId?: string };
    if (!body.productId) throw new StoreError("Не указан товар.", 400);
    await addFavorite(uid, body.productId);
    return NextResponse.json({ products: await getUserFavorites(uid) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось добавить в избранное." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}

export async function DELETE(request: Request) {
  try {
    const uid = await userId(request);
    const body = await request.json() as { productId?: string };
    if (!body.productId) throw new StoreError("Не указан товар.", 400);
    await removeFavorite(uid, body.productId);
    return NextResponse.json({ products: await getUserFavorites(uid) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось удалить из избранного." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
