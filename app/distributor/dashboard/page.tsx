import { redirect } from "next/navigation";
import { requireRole } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Кабинет дистрибьютора — HASI.TJ" };

export default async function DistributorDashboardPage() {
  // Сюда попадают дистрибьюторы и дилеры (после входа).
  // Перенаправляем в каталог товаров.
  await requireRole(["DISTRIBUTOR", "DEALER"]);
  redirect("/distributor/catalog");
}
