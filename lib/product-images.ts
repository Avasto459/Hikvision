export function productImageSrc(source: string) {
  const value = source.trim();
  if (!value) return "";
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(value)) return value;
  if (value.startsWith("public/")) return `/${value.slice("public/".length)}`;
  if (value.startsWith("./")) return `/${value.slice(2)}`;
  return value.startsWith("/") ? value : `/${value}`;
}
