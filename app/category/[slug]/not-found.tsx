import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

/** Shown when /category/<slug> is opened for a slug that is not in the catalog. */
export default function CategoryNotFound() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white">Категория не найдена</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Такой категории нет в каталоге. Выберите нужную категорию на главной странице.
          </p>
          <Link href="/catalog" className="mt-8 inline-flex rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-500">
            Вернуться в каталог
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
