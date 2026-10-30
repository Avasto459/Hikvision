import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { CatalogSearchInput } from "@/components/catalog-search-input";
import { SiteShell } from "@/components/site-shell";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { categoryImageMap } from "@/lib/partner-catalog";
import { CategoryFilter } from "@/components/category-filter";
import { PromoBanner } from "@/components/promo-banner";
import { getActivePromos } from "@/lib/promos";
import { countProducts, getDealProducts, getCategoryPath, getCategoryTree, getProductBrands, getProducts } from "@/lib/db";

const PAGE_SIZE = 48;

function parsePrice(value: string | string[] | undefined) {
  if (typeof value !== "string" || value.trim() === "") return { value: undefined, invalid: false };
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? { value: parsed, invalid: false }
    : { value: undefined, invalid: true };
}

export default async function CatalogPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const category = typeof params.category === "string" ? params.category : undefined;
  const search = typeof params.search === "string" ? params.search : "";
  const brand = typeof params.brand === "string" ? params.brand : undefined;
  const minPriceResult = parsePrice(params.minPrice);
  const maxPriceResult = parsePrice(params.maxPrice);
  const minPrice = minPriceResult.value;
  const maxPrice = maxPriceResult.value;
  const invalidPrice = minPriceResult.invalid || maxPriceResult.invalid;
  const inStock = params.inStock === "true";
  const requestedSort = typeof params.sort === "string" ? params.sort : "newest";
  const sort = requestedSort === "price-asc" || requestedSort === "price-desc" || requestedSort === "name"
    ? requestedSort
    : "newest";
  const tree = await getCategoryTree();
  const images = await categoryImageMap();
  const path = category ? await getCategoryPath(category) : [];
  const current = path[path.length - 1];
  const activeMain = path[0];
  const activeNode = tree.find((node) => node.id === activeMain?.id);
  const subcategories = activeNode?.children ?? [];
  const isSub = path.length === 2;
  const page0 = () => !params.page || params.page === "1";
  const hasFilters = Boolean(search || brand || minPrice !== undefined || maxPrice !== undefined || inStock || invalidPrice);

  // Главная категория с подкатегориями: вместо всех товаров показываем плитки подкатегорий.
  const showSubcategoryTiles = Boolean(current && !isSub && subcategories.length > 0 && !hasFilters);
  const brands = await getProductBrands(category);
  const promos = !hasFilters && !category && page0() ? await getActivePromos() : [];
  const deals = !hasFilters && !category && page0() ? (await getDealProducts(8)).map((d) => ({ id: d.id, slug: d.slug, name: d.name, brand: d.brand, price: d.price, previousPrice: Number(d.previousPrice), image: d.image })) : [];
  // Для плиток подкатегорий выводим только товары, лежащие прямо в главной категории (если они есть).
  const filter = { categorySlug: category, search, brand, minPrice, maxPrice, inStock, sort };
  const requestedPage = Number(typeof params.page === "string" ? params.page : 1);
  const totalProducts = invalidPrice ? 0 : await countProducts(filter);
  const pages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? Math.min(requestedPage, pages) : 1;
  const products = invalidPrice ? [] : await getProducts({ ...filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const pageHref = (n: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ category, search, brand, minPrice: minPrice?.toString(), maxPrice: maxPrice?.toString(), inStock: inStock ? "true" : undefined, sort: sort === "newest" ? undefined : sort })) if (value) query.set(key, value);
    if (n > 1) query.set("page", String(n));
    const text = query.toString();
    return text ? `/catalog?${text}` : "/catalog";
  };
  const directProducts = showSubcategoryTiles && current ? products.filter((item) => item.categoryId === current.id) : products;
  const visibleProducts = showSubcategoryTiles ? directProducts : products;

  const crumbs: Crumb[] = [{ label: "Главная", href: "/" }, { label: "Каталог", href: current ? "/catalog" : undefined }];
  for (const [index, item] of path.entries()) {
    crumbs.push({ label: item.name, href: index === path.length - 1 ? undefined : `/catalog?category=${encodeURIComponent(item.slug)}` });
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl min-w-0 px-3 pb-24 pt-8 sm:px-6 sm:py-14 lg:px-8">
        <Breadcrumbs items={crumbs} />

        {current ? (
          <div className="mb-4">
            <h1 className="break-words text-2xl font-black leading-tight text-slate-900 sm:text-3xl dark:text-white">{current.name}</h1>
            {current.description ? <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{current.description}</p> : null}
          </div>
        ) : null}

        {deals.length || promos.length ? <PromoBanner deals={deals} promos={promos} /> : null}
        <div id="categories" className="rounded-3xl border border-slate-200 bg-white/70 px-2 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
          <CategoryFilter
            categories={tree.map((item) => ({ slug: item.slug, name: item.name, count: item.productCount, image: item.image || images.get(item.slug) || undefined, icon: item.icon || undefined }))}
            active={activeMain?.slug ?? ""}
            keepQuery={{ search: search || undefined, brand, inStock: inStock ? "true" : undefined, sort: sort === "newest" ? undefined : sort }}
          />
        </div>
        {isSub && activeMain && subcategories.length > 0 ? (
          <div aria-label={`Подкатегории «${activeMain.name}»`} className="-mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <Link href={`/catalog?category=${encodeURIComponent(activeMain.slug)}`} className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Все: {activeMain.name}</Link>
            {subcategories.map((item) => (
              <Link key={item.id} href={`/catalog?category=${encodeURIComponent(item.slug)}`} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm ${current?.id === item.id ? "border-violet-600 bg-violet-50 font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                {item.name}
              </Link>
            ))}
          </div>
        ) : null}

        {showSubcategoryTiles ? (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Выберите подкатегорию</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {subcategories.map((item) => {
                return (
                  <Link key={item.id} href={`/catalog?category=${encodeURIComponent(item.slug)}`} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-lg font-bold text-slate-900 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-300">{item.name}</p>
                    {item.subtitle || item.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{item.subtitle || item.description}</p> : null}
                    <p className="mt-3 text-sm font-semibold text-violet-700 dark:text-violet-300">Смотреть →</p>
                  </Link>
                );
              })}
            </div>
            {visibleProducts.length ? <h2 className="mt-10 text-lg font-bold text-slate-900 dark:text-white">Без подкатегории</h2> : null}
          </div>
        ) : null}

        {invalidPrice ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">Укажите неотрицательную цену числом.</p> : null}
        <form id="catalog-filters-form" action="/catalog" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          {brand ? <input type="hidden" name="brand" value={brand} /> : null}
          <div className="min-w-0 flex-1"><CatalogSearchInput defaultValue={search} /></div>
          <select name="sort" defaultValue={sort} aria-label="Сортировка" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="newest">Сначала новые</option>
            <option value="price-asc">Сначала дешевле</option>
            <option value="price-desc">Сначала дороже</option>
            <option value="name">По названию</option>
          </select>
          {hasFilters ? <Link href="/catalog" className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Сбросить</Link> : null}
        </form>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((product) => <ProductCard key={product.id} product={product} favorite cart />)}
        </div>
        {pages > 1 && !showSubcategoryTiles ? (
          <nav aria-label="Страницы каталога" className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold">
            {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900">← Назад</Link> : null}
            <span className="px-3 text-slate-500">Страница {page} из {pages} · всего {totalProducts}</span>
            {page < pages ? <Link href={pageHref(page + 1)} className="rounded-xl bg-violet-700 px-4 py-2 text-white hover:bg-violet-600">Далее →</Link> : null}
          </nav>
        ) : null}
        {visibleProducts.length === 0 && !showSubcategoryTiles ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold text-slate-900 dark:text-white">{hasFilters || category ? "По выбранным условиям позиции не найдены." : "В базе пока нет опубликованных товаров."}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Проверьте фильтры или обратитесь к администратору каталога.</p>
            {hasFilters || category ? <Link href="/catalog" className="mt-4 inline-flex text-sm font-semibold text-violet-700 dark:text-violet-300">Сбросить фильтры</Link> : null}
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}
