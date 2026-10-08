export function normalizeTajikPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("992") && digits.length === 12 ? digits.slice(3) : digits;
  return /^\d{9}$/.test(local) ? `+992${local}` : null;
}
