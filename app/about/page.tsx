import { SiteShell } from "@/components/site-shell";

export default function AboutPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">О нас</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white">HASI.TJ — оборудование для видеонаблюдения</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
            HASI.TJ специализируется на продаже камер видеонаблюдения и оборудования для систем безопасности. В каталоге представлены категории IP-камер, Wi-Fi и уличных камер, видеорегистраторов, комплектов и аксессуаров.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/75"><div className="text-lg font-bold text-slate-900 dark:text-white">Камеры</div><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Сетевые, беспроводные, уличные и поворотные камеры.</p></div>
            <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/75"><div className="text-lg font-bold text-slate-900 dark:text-white">Запись и хранение</div><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Видеорегистраторы и диски для хранения записей.</p></div>
            <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/75"><div className="text-lg font-bold text-slate-900 dark:text-white">Комплектующие</div><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Кабели, блоки питания и аксессуары для систем.</p></div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
