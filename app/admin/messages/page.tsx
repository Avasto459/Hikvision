import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminChat } from "@/components/admin-chat";
import { isPrimaryAdminEmail } from "@/lib/jwt-secret";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сообщения — админка" };

export default async function AdminMessagesPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session || (session.role !== "ADMIN" && !isPrimaryAdminEmail(session.email))) redirect("/login?next=/admin/messages");

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-black sm:text-3xl">Сообщения / Чат</h1>
      <AdminChat />
    </main>
  );
}
