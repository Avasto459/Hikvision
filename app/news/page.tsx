import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export default function NewsPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">HASI.TJ</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Полезная информация</h1>
          <p className="mt-6 text-slate-600 dark:text-slate-300">Новости магазина публикуются после подтверждения. Здесь не размещаются демонстрационные акции или неактуальные товары.</p>
          <Link href="/catalog" className="mt-6 inline-flex rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white">Перейти к оборудованию</Link>
        </div>
      </section>
    </SiteShell>
  );
}
