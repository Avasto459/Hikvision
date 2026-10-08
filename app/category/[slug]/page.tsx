import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { SiteShell } from "@/components/site-shell";
import { getCategoryBySlug, getProducts } from "@/lib/db";

// A category page must always reflect the current assortment, so it is rendered
// per request instead of being served from a cached render of the same slug.
export const dynamic = "force-dynamic";

function productCountLabel(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14
    ? "товаров"
    : mod10 === 1
      ? "товар"
      : mod10 >= 2 && mod10 <= 4
        ? "товара"
        : "товаров";
  return `${count} ${noun}`;
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 1. The slug identifies exactly one category.
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  // 2. Only the products pointing at that category id are loaded, published ones.
  const products = await getProducts({ categoryId: category.id, limit: 100 });

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-violet-600 dark:hover:text-violet-300">Главная</Link>
          <span>/</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{category.name}</span>
        </div>

        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {category.image ? <Image src={category.image} alt={category.name} width={1200} height={220} unoptimized className="h-[220px] w-full object-cover" /> : null}
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">{category.subtitle}</p>
            <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">{category.name}</h1>
            <p className="mt-4 max-w-3xl text-slate-600 dark:text-slate-300">{category.description}</p>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{productCountLabel(products.length)}</span>
              <span aria-hidden="true">·</span>
              <Link href={`/catalog?category=${encodeURIComponent(category.slug)}`} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">Все товары категории →</Link>
            </p>
          </div>
        </div>

        {products.length ? (
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <p className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">В этой категории пока нет товаров.</p>
        )}
      </section>
    </SiteShell>
  );
}
