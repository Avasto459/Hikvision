/** Набор иконок категорий: ключ хранится в categories.icon, подпись показывается в админке. */
export const CATEGORY_ICON_KEYS = ["camera", "server", "disk", "network", "wifi", "bell", "fingerprint", "lock", "phone", "cable", "monitor", "tool", "package"] as const;
export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export const CATEGORY_ICON_LABELS: Record<CategoryIconKey, string> = {
  camera: "Камера", server: "Регистратор / сервер", disk: "Накопитель", network: "Сеть / коммутатор", wifi: "Wi‑Fi",
  bell: "Сигнализация", fingerprint: "Контроль доступа", lock: "Замок", phone: "Домофон", cable: "Кабель / питание",
  monitor: "Монитор", tool: "Инструмент / монтаж", package: "Прочее",
};

export function isCategoryIcon(value: unknown): value is CategoryIconKey {
  return typeof value === "string" && (CATEGORY_ICON_KEYS as readonly string[]).includes(value);
}
