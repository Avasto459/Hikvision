import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { StoreError } from "@/lib/db";
import { db } from "@/lib/db/db";
import { initializeSchema } from "@/lib/db/schema";
import { canonicalBrand, PricingError, priceCalculator } from "@/lib/pricing";
import { productImageSrc, DEFAULT_PRODUCT_IMAGE } from "@/lib/product-images";
import { saveProductImages } from "@/lib/product-upload";
import { isSafeImageUrl, MAX_IMAGES, parseUsd, productTitle, validateDistributorProduct } from "@/lib/distributor-product";

export const runtime = "nodejs";

const CENTRAL = "hasi-central";

function fail(error: unknown, fallback: string) {
  if (error && !(error instanceof StoreError)) console.error("Distributor product:", error);
  return NextResponse.json({ error: error instanceof StoreError ? error.message : fallback }, {
    status: error instanceof StoreError ? error.status : 500,
  });
}

/** Менять/удалять можно только СВОИ товары (admin — любые). Дилер и дистрибьютор — только свои. */
async function loadOwned(request: Request, id: string) {
  const user = await requireUser(request);
  if (user.role !== "DISTRIBUTOR" && user.role !== "DEALER" && user.role !== "ADMIN") throw new StoreError("Недостаточно прав.", 403);
  await initializeSchema();
  const r = await db.execute({ sql: "SELECT * FROM products WHERE id=? LIMIT 1", args: [id] });
  const row = r.rows[0];
  if (!row) throw new StoreError("Товар не найден.", 404);
  if (user.role !== "ADMIN" && String(row.distributor_id || "") !== user.id) throw new StoreError("Это не ваш товар.", 403);
  return { user, row };
}

function parseImages(value: unknown): string[] {
  try {
    const list = JSON.parse(String(value || "[]"));
    return Array.isArray(list) ? list.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Данные для формы редактирования. Закупочная цена в $ берётся со склада (offers_stock = $ × 10). */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { row } = await loadOwned(request, id);
    const stockRow = await db.execute({ sql: "SELECT purchasePrice FROM offers_stock WHERE warehouseId=? AND productId=? LIMIT 1", args: [CENTRAL, id] });
    const purchase = Number(stockRow.rows[0]?.purchasePrice);
    const brand = String(row.brand || "");
    let priceUsd = Number.isFinite(purchase) && purchase > 0 ? purchase / 10 : 0;
    if (!priceUsd) priceUsd = Number(row.price) / (10 * (1 + priceCalculator.calculate(brand || "x", 1).markupPercent / 100));
    return NextResponse.json({ product: {
      id, name: String(row.name), brand, categoryId: String(row.categoryId), description: String(row.description || ""),
      stock: Number(row.stock), priceUsd: Math.round(priceUsd * 100) / 100, price: Number(row.price),
      images: parseImages(row.images).map(productImageSrc), isPublished: Number(row.isPublished),
    } });
  } catch (error) {
    return fail(error, "Не удалось загрузить товар.");
  }
}

/**
 * Изменение товара: multipart/form-data как при создании + keepImages (какие старые фото оставить).
 * Цена пересчитывается на сервере по бренду.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { row } = await loadOwned(request, id);
    const form = await request.formData();
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const input = {
      brand: text("brand"), model: text("model"), specs: text("specs"), categoryId: text("categoryId"),
      priceUsd: text("priceUsd"), stock: text("stock") || "0", description: text("description"),
    };
    const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
    const urls = [...new Set(form.getAll("imageUrls").map((v) => String(v).trim()).filter(Boolean))];
    const existing = parseImages(row.images);
    const keep = form.getAll("keepImages").map((v) => String(v)).filter((v) => existing.some((e) => productImageSrc(e) === v || e === v));
    const keepRaw = existing.filter((e) => keep.includes(e) || keep.includes(productImageSrc(e)));

    const problems = validateDistributorProduct(input, files.length + urls.length + keepRaw.length);
    const firstProblem = Object.values(problems)[0];
    if (firstProblem) throw new StoreError(firstProblem, 400);
    if (urls.some((u) => !isSafeImageUrl(u))) throw new StoreError("Ссылка на фото должна начинаться с http:// или https://.", 400);
    if (files.length + urls.length + keepRaw.length > MAX_IMAGES) throw new StoreError(`Не более ${MAX_IMAGES} фотографий.`, 400);

    const category = await db.execute({ sql: "SELECT id FROM categories WHERE id=? LIMIT 1", args: [input.categoryId] });
    if (!category.rows.length) throw new StoreError("Выбранная категория не найдена.", 400);

    const usd = parseUsd(input.priceUsd);
    let price: number;
    try {
      price = priceCalculator.calculate(input.brand, usd).retailTjs;
    } catch (error) {
      throw new StoreError(error instanceof PricingError ? error.message : "Не удалось рассчитать цену.", 400);
    }
    const stock = Number(input.stock);
    const description = input.description.slice(0, 5000);
    const images = [...keepRaw, ...(await saveProductImages(files)), ...urls];
    const now = new Date().toISOString();

    await db.batch([
      {
        sql: `UPDATE products SET name=?, brand=?, shortDescription=?, description=?, price=?, previousPrice=NULL, stock=?, images=?, image=?, categoryId=? WHERE id=?`,
        args: [productTitle(input), canonicalBrand(input.brand), description.slice(0, 160), description, price, stock, JSON.stringify(images), images[0] || DEFAULT_PRODUCT_IMAGE, input.categoryId, id],
      },
      {
        sql: `INSERT INTO offers_stock(id,warehouseId,productId,qty,purchasePrice,updatedAt)
              SELECT lower(hex(randomblob(16))),?,?,?,?,? WHERE EXISTS (SELECT 1 FROM warehouses WHERE id=?)
              ON CONFLICT(warehouseId,productId) DO UPDATE SET qty=excluded.qty, purchasePrice=excluded.purchasePrice, updatedAt=excluded.updatedAt`,
        args: [CENTRAL, id, stock, Math.round(usd * 10 * 100) / 100, now, CENTRAL],
      },
    ], "write");
    return NextResponse.json({ ok: true, price });
  } catch (error) {
    return fail(error, "Не удалось изменить товар.");
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await loadOwned(request, id);
    await db.batch([
      { sql: "DELETE FROM offers_stock WHERE productId=?", args: [id] },
      { sql: "DELETE FROM cartItems WHERE productId=?", args: [id] },
      { sql: "DELETE FROM userFavorites WHERE productId=?", args: [id] },
      { sql: "DELETE FROM products WHERE id=?", args: [id] },
    ], "write");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error, "Не удалось удалить товар.");
  }
}
