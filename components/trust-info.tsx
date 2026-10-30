import { ShieldCheck, Truck, Wallet } from "lucide-react";

/** Условия, одинаковые для карточки товара и оформления заказа. */
export const TRUST_ITEMS = [
  { icon: Truck, title: "Доставка", text: "Экспресс-доставка по Худжанду и регионам РТ (1–3 дня)" },
  { icon: Wallet, title: "Оплата", text: "Наличными при получении или переводом (Корти Милли / QR)" },
  { icon: ShieldCheck, title: "Гарантия", text: "Официальная гарантия 12 месяцев" },
] as const;

export function TrustInfo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-3"}>
      {TRUST_ITEMS.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
