const UI_SEPARATOR = "\u2022";

const BROKEN_BULLET_TOKENS = [
  "\u00E2\u20AC\u00A2",
  "\u0623\u00A2\u00E2\u201A\u00AC\u0622\u00A2",
  "\u0637\u00A3\u0622\u00A2\u0623\u00A2\u00E2\u20AC\u0691\u0622\u00AC\u0637\u00A2\u0622\u00A2",
];

export function sanitizeUiText(value: string) {
  let nextValue = value;

  for (const token of BROKEN_BULLET_TOKENS) {
    nextValue = nextValue.split(token).join(UI_SEPARATOR);
  }

  return nextValue;
}

export function joinUiSegments(parts: Array<string | number | null | undefined>) {
  const normalized = parts
    .map((part) => sanitizeUiText(String(part ?? "").trim()))
    .filter(Boolean);

  return normalized.join(` ${UI_SEPARATOR} `);
}
