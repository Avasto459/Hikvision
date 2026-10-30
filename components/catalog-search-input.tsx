"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Debounced live catalog search; preserves category/brand/price filters in the URL. */
export function CatalogSearchInput({ name = "search", defaultValue = "" }: { name?: string; defaultValue?: string; formId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <input type="search" name={name} value={value} onChange={(event) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (nextValue.trim()) params.set(name, nextValue.trim()); else params.delete(name);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 300);
  }} onKeyDown={(event) => { if (event.key === "Enter" && timer.current) clearTimeout(timer.current); }} placeholder="Например, Hikvision или DS-2CD…" aria-label="Поиск по названию или артикулу" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />;
}
