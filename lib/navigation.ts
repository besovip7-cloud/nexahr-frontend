type SearchParamPrimitive = string | number | boolean;
type SearchParamValue =
  | SearchParamPrimitive
  | SearchParamPrimitive[]
  | null
  | undefined;

export type SearchParams = Record<string, SearchParamValue>;

export function withSearch(path: string, searchParams?: SearchParams) {
  if (!searchParams) return path;

  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const pathWithoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = pathWithoutHash.indexOf("?");
  const basePath = queryIndex >= 0 ? pathWithoutHash.slice(0, queryIndex) : pathWithoutHash;
  const existingQuery = queryIndex >= 0 ? pathWithoutHash.slice(queryIndex + 1) : "";

  const query = new URLSearchParams(existingQuery);

  for (const [key, value] of Object.entries(searchParams)) {
    query.delete(key);

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      query.append(key, String(value));
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, String(item));
      }
    }
  }

  const queryString = query.toString();
  return `${basePath}${queryString ? `?${queryString}` : ""}${hash}`;
}
