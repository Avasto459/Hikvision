import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DistributorsManager } from "@/components/distributors-manager";
import { isPrimaryAdminEmail } from "@/lib/jwt-secret";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Дистрибьюторы — админка" };

export default async function AdminDistributorsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session || (session.role !== "ADMIN" && !isPrimaryAdminEmail(session.email))) redirect("/login?next=/admin/distributors");

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-black sm:text-3xl">Дистрибьюторы</h1>
      <DistributorsManager />
    </main>
  );
}
