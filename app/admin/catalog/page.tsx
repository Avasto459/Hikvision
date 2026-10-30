import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { isPrimaryAdminEmail } from "@/lib/jwt-secret";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Каталог — админка HASI.TJ" };

export default async function AdminCatalogPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session || (session.role !== "ADMIN" && !isPrimaryAdminEmail(session.email))) redirect("/login?next=/admin/catalog");
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-black sm:text-3xl">Каталог</h1>
      <AdminDashboard initialTab="catalog" />
    </div>
  );
}
