import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export default function NotFound() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-8xl font-black text-violet-600 dark:text-violet-300">404</div>
          <h1 className="mt-6 text-4xl font-black text-slate-900 dark:text-white">Страница не найдена</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-300">Такой страницы больше нет или она была перемещена.</p>
          <Link href="/" className="mt-8 inline-flex rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-500">Вернуться на главную</Link>
        </div>
      </section>
    </SiteShell>
  );
}
