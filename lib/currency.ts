export function formatTjs(amount: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount)} сомони`;
}
