import { Suspense } from "react";
import { SearchResults } from "@/components/search-results";

export default function SearchPage() {
  return <Suspense fallback={<div className="p-12 text-center">Загрузка результатов…</div>}><SearchResults /></Suspense>;
}
