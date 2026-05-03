function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePositiveInt(value: unknown): number | null {
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      return null;
    }

    return parsePositiveInt(value[0]);
  }

  const parsed = parseFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = parseFiniteNumber(value);
  return parsed === null ? fallback : parsed;
}
