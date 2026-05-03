export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function toMonthInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function getTodayDateInputValue(baseDate: Date = new Date()): string {
  return toDateInputValue(baseDate);
}

export function getMonthStartDateInputValue(baseDate: Date = new Date()): string {
  return toDateInputValue(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
}

const DATE_INPUT_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateInputValue(value?: string | null): value is string {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!DATE_INPUT_VALUE_PATTERN.test(trimmed)) return false;

  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;

  return toDateInputValue(parsed) === trimmed;
}

export function isValidDateInputRange(from?: string | null, to?: string | null) {
  if (!isValidDateInputValue(from) || !isValidDateInputValue(to)) {
    return false;
  }

  return from <= to;
}

type FormatMinutesCompactOptions = {
  fallback?: string;
  zeroLabel?: string;
};

export function formatMinutesCompact(
  minutes?: number | string | null,
  options: FormatMinutesCompactOptions = {},
): string {
  const { fallback = "0m", zeroLabel = "0m" } = options;

  if (minutes === null || minutes === undefined || minutes === "") {
    return fallback;
  }

  const numericValue = Number(minutes);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const sign = numericValue < 0 ? "-" : "";
  const totalMinutes = Math.abs(Math.trunc(numericValue));

  if (totalMinutes === 0) {
    return zeroLabel;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours <= 0) return `${sign}${mins}m`;
  if (mins <= 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${mins}m`;
}

export function formatTimeSafe(
  value?: string | Date | null,
  fallback = "--",
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatDateTimeSafe(
  value?: string | Date | null,
  fallback = "-",
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString(locale, options);
}

export function formatDateSafe(
  value?: string | Date | null,
  fallback = "-",
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleDateString(locale, options);
}
