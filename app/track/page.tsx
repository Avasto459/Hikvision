import { GuestTrack } from "@/components/guest-track";
import { SiteShell } from "@/components/site-shell";

export const metadata = { title: "Отследить заказ — HASI.TJ" };

export default async function TrackLookupPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const order = typeof params.order === "string" ? params.order.slice(0, 40) : "";
  return (
    <SiteShell>
      <div className="min-h-[70vh] bg-gradient-to-b from-[#050b1c] via-[#0a1230] to-[#050b1c]">
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <GuestTrack initialNumber={order} />
        </main>
      </div>
    </SiteShell>
  );
}
