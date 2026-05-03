export function parseJsonOrThrow<T = unknown>(
  raw: string,
  message = "Invalid JSON payload.",
): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(message);
  }
}
