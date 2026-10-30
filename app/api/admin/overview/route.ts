import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAdminUsers, getDashboardOverview, StoreError } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const overview = await getDashboardOverview();
    return NextResponse.json({
      users: overview.users,
      categories: overview.categories,
      products: overview.products,
      orders: overview.orders,
      recent: overview.recent,
      usersList: await getAdminUsers(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить панель администратора." }, {
      status: error instanceof StoreError ? error.status : 500,
    });
  }
}
