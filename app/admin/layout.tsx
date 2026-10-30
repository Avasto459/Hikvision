import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";

/** Изолированный макет /admin/*: никаких блоков публичной главной страницы и витрины. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
