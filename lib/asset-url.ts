import { getApiOrigin } from "./api";

export function resolveAssetUrl(value?: string | null) {
  const clean = (value || "").trim();
  if (!clean) return "";
  if (/^(?:https?:)?\/\//i.test(clean)) return clean;
  if (/^(?:data|blob):/i.test(clean)) return clean;

  const origin = getApiOrigin();
  return `${origin}${clean.startsWith("/") ? clean : `/${clean}`}`;
}
