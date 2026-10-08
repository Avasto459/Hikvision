import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSiteSettings, saveActivity, setSetting, StoreError } from "@/lib/db";

const publicKeys = ["site_name", "phone", "address", "about"] as const;

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const all = await getSiteSettings();
    return NextResponse.json({ settings: Object.fromEntries(publicKeys.map((key) => [key, all[key] || ""])) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить настройки." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    for (const key of publicKeys) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== "string" || value.length > 1000) throw new StoreError(`Поле «${key}» заполнено некорректно.`, 400);
      if ((key === "site_name" || key === "phone") && !value.trim()) throw new StoreError("Название сайта и телефон обязательны.", 400);
      setSetting(key, value.trim());
    }
    await saveActivity(actor.id, "settings-update", "Обновлены настройки сайта");
    const all = await getSiteSettings();
    return NextResponse.json({ success: true, settings: Object.fromEntries(publicKeys.map((key) => [key, all[key] || ""])) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить настройки." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
