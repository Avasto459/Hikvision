import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createProduct, getUserById, getUserDisplayName, StoreError } from "@/lib/db";
import { db } from "@/lib/db/db";
import { initializeSchema } from "@/lib/db/schema";
import { DEFAULT_PRODUCT_IMAGE, productImageSrc } from "@/lib/product-images";
import { canonicalBrand, PricingError, priceCalculator } from "@/lib/pricing";
import { makeSlug, saveProductImages } from "@/lib/product-upload";
import { isSafeImageUrl, MAX_IMAGES, parseUsd, productTitle, validateDistributorProduct } from "@/lib/distributor-product";

export const runtime = "nodejs";

/** Доступ только для DISTRIBUTOR и DEALER; администратор тоже может — но товар не помечается как дистрибьюторский. */
async function requirePartner(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "DISTRIBUTOR" && user.role !== "DEALER") throw new StoreError("Недостаточно прав.", 403);
  return user;
}

function fail(error: unknown, fallback: string) {
  if (error && !(error instanceof StoreError)) console.error("Distributor products:", error);
  return NextResponse.json({ error: error instanceof Error && error instanceof StoreError ? error.message : fallback }, {
    status: error instanceof StoreError ? error.status : 500,
  });
}

/** Свои товары дистрибьютора (по distributor_id). */
export async function GET(request: Request) {
  try {
    const user = await requirePartner(request);
    await initializeSchema();
    const r = await db.execute({
      sql: `SELECT id,name,slug,brand,price,stock,image,isPublished,createdAt FROM products WHERE distributor_id=? ORDER BY datetime(createdAt) DESC LIMIT 100`,
      args: [user.id],
    });
    return NextResponse.json({ products: r.rows.map((x) => ({
      id: String(x.id), name: String(x.name), slug: String(x.slug), brand: String(x.brand || ""), price: Number(x.price), stock: Number(x.stock),
      image: productImageSrc(String(x.image || "")), isPublished: Number(x.isPublished), createdAt: String(x.createdAt),
    })) });
  } catch (error) {
    return fail(error, "Не удалось загрузить товары.");
  }
}

/**
 * Создание товара: multipart/form-data
 * (brand, model, specs, categoryId, priceUsd, stock, description, images[] — файлы, imageUrls — ссылки, по одной на поле).
 * Розничная цена в сомони считается ЗДЕСЬ по правилам бренда; цена из браузера не принимается.
 */
export async function POST(request: Request) {
  try {
    const user = await requirePartner(request);
    const account = await getUserById(user.id);
    if (!account) throw new StoreError("Пользователь не найден.", 404);

    const form = await request.formData();
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const input = {
      brand: text("brand"), model: text("model"), specs: text("specs"), categoryId: text("categoryId"),
      priceUsd: text("priceUsd"), stock: text("stock") || "0", description: text("description"),
    };

    const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
    const urls = [...new Set(form.getAll("imageUrls").map((v) => String(v).trim()).filter(Boolean))];
    const problems = validateDistributorProduct(input, files.length + urls.length);
    const firstProblem = Object.values(problems)[0];
    if (firstProblem) throw new StoreError(firstProblem, 400);
    if (urls.some((u) => !isSafeImageUrl(u))) throw new StoreError("Ссылка на фото должна начинаться с http:// или https://.", 400);

    const category = await db.execute({ sql: "SELECT id FROM categories WHERE id=? LIMIT 1", args: [input.categoryId] });
    if (!category.rows.length) throw new StoreError("Выбранная категория не найдена.", 400);

    let price: number;
    try {
      price = priceCalculator.calculate(input.brand, parseUsd(input.priceUsd)).retailTjs;
    } catch (error) {
      throw new StoreError(error instanceof PricingError ? error.message : "Не удалось рассчитать цену.", 400);
    }
    const stock = Number(input.stock);
    const name = productTitle(input);
    const brand = canonicalBrand(input.brand);
    const description = input.description.slice(0, 5000);

    const images: string[] = await saveProductImages(files);
    images.push(...urls);

    const product = await createProduct({
      name,
      slug: makeSlug(name),
      brand,
      shortDescription: description.slice(0, 160),
      description,
      price,
      stock,
      images,
      image: images[0] || DEFAULT_PRODUCT_IMAGE,
      categoryId: input.categoryId,
      type: "product",
      // Привязка к дистрибьютору: ID и имя текущего пользователя.
      distributorId: account.id,
      distributorName: getUserDisplayName(account) || account.email,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return fail(error, "Не удалось добавить товар.");
  }
}
