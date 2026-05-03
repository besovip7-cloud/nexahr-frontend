import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  logoutAndRedirectToLogin,
  setAuthTokens,
} from "./auth";

const DEFAULT_API_BASE_URL = "http://localhost:4000/api";

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_API_BASE_URL;
  return trimmed.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  return normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL,
  );
}

export function getApiOrigin() {
  try {
    return new URL(getApiBaseUrl()).origin;
  } catch {
    return getApiBaseUrl().replace(/\/api\/?$/, "");
  }
}

const API_BASE_URL = getApiBaseUrl();

function buildApiUrl(endpoint: string) {
  const normalizedInput = endpoint.trim();

  if (!normalizedInput) {
    return API_BASE_URL;
  }

  if (normalizedInput.startsWith("//")) {
    return normalizedInput;
  }

  if (/^https?:\/\//i.test(normalizedInput)) {
    return normalizedInput;
  }

  const normalizedEndpoint = normalizedInput.startsWith("/")
    ? normalizedInput
    : `/${normalizedInput}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
}

function shouldAttachAuthHeader(requestUrl: string) {
  try {
    const apiOrigin = new URL(API_BASE_URL).origin;
    const requestOrigin = new URL(requestUrl, API_BASE_URL).origin;
    return requestOrigin === apiOrigin;
  } catch {
    // Fail closed: if URL parsing fails, do not leak Authorization header.
    return false;
  }
}

function isBodyInitLike(value: unknown): value is BodyInit {
  if (typeof value === "string") return true;
  if (typeof FormData !== "undefined" && value instanceof FormData) return true;
  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) {
    return true;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;

  if (typeof ArrayBuffer !== "undefined") {
    if (value instanceof ArrayBuffer) return true;
    if (ArrayBuffer.isView(value)) return true;
  }

  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
    return true;
  }

  return false;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  auth?: boolean;
  responseType?: "auto" | "json" | "text" | "blob" | "response";
  body?: unknown;
};

type ApiError = Error & {
  status?: number;
  data?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getErrorMessage(data: unknown, fallback = "Request failed"): string {
  if (data instanceof Error && data.message.trim()) {
    return data.message;
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (isRecord(data)) {
    const message = data.message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }

    if (Array.isArray(message)) {
      const messageParts = message.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );

      if (messageParts.length > 0) {
        return messageParts.join(", ");
      }
    }
  }

  return fallback;
}

export function isAuthError(data: unknown) {
  if (isRecord(data)) {
    const status = data.status;
    if (status === 401 || status === 403) {
      return true;
    }
  }

  const text = getErrorMessage(data, "").toLowerCase();
  return text.includes("unauthorized") || text.includes("forbidden");
}

type LoginRedirectRouter = {
  replace: (href: string) => void;
};

export function handleAuthError(
  error: unknown,
  router?: LoginRedirectRouter,
) {
  if (!isAuthError(error)) {
    return false;
  }

  logoutAndRedirectToLogin(router);
  return true;
}

function createApiError(status: number, data: unknown): ApiError {
  const error = new Error(
    getErrorMessage(data, `Request failed with status ${status}`),
  ) as ApiError;
  error.status = status;
  error.data = data;
  return error;
}

async function parseResponseData(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  const hasJson = contentType.toLowerCase().includes("json");

  try {
    const text = await res.text();
    if (!text) return null;

    if (hasJson) {
      try {
        return JSON.parse(text);
      } catch {
        // Some backends mislabel plain text as JSON. Keep the raw text.
        return text;
      }
    }

    return text;
  } catch {
    return null;
  }
}

async function parseJsonBody<T>(res: Response): Promise<T> {
  if (res.status === 204 || res.status === 205 || res.status === 304) {
    return null as T;
  }

  const text = await res.text();
  if (!text.trim()) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw createApiError(res.status, {
      message: "Invalid JSON response from server.",
    });
  }
}

type RefreshTokenResponse = {
  access_token: string;
  refresh_token?: string;
};

let refreshAccessTokenPromise: Promise<string | null> | null = null;

function isRefreshTokenResponse(data: unknown): data is RefreshTokenResponse {
  if (!isRecord(data)) {
    return false;
  }

  if (typeof data.access_token !== "string" || !data.access_token.trim()) {
    return false;
  }

  return data.refresh_token === undefined || typeof data.refresh_token === "string";
}

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) return null;

  try {
    const res = await fetch(buildApiUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await parseResponseData(res);

    if (!res.ok || !isRefreshTokenResponse(data)) {
      clearAuthTokens();
      return null;
    }

    const nextRefreshToken = data.refresh_token || refreshToken;
    setAuthTokens(data.access_token, nextRefreshToken);

    return data.access_token;
  } catch {
    clearAuthTokens();
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshAccessTokenPromise) {
    return refreshAccessTokenPromise;
  }

  refreshAccessTokenPromise = performTokenRefresh().finally(() => {
    refreshAccessTokenPromise = null;
  });

  return refreshAccessTokenPromise;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { auth = true, responseType = "auto", headers, body, ...rest } = options;

  const accessToken = auth ? getAccessToken() : null;

  const makeRequest = async (token?: string | null) => {
    const requestUrl = buildApiUrl(endpoint);
    const hasBody = body != null;
    const hasNativeBody = isBodyInitLike(body);
    const shouldSerializeJson = hasBody && !hasNativeBody;
    const requestHeaders = new Headers(headers || {});

    if (shouldSerializeJson && !requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }

    if (auth && token && shouldAttachAuthHeader(requestUrl)) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }

    return fetch(requestUrl, {
      ...rest,
      headers: requestHeaders,
      body: !hasBody
        ? undefined
        : shouldSerializeJson
        ? JSON.stringify(body)
        : (body as BodyInit),
      cache: "no-store",
    });
  };

  let res = await makeRequest(accessToken);

  if (auth && res.status === 401) {
    const newAccessToken = await refreshAccessToken();

    if (!newAccessToken) {
      logoutAndRedirectToLogin();
      throw createApiError(401, { message: "Unauthorized" });
    }

    res = await makeRequest(newAccessToken);
  }

  if (!res.ok) {
    const data = await parseResponseData(res);
    throw createApiError(res.status, data);
  }

  if (responseType === "response") {
    return res as T;
  }

  if (responseType === "blob") {
    return (await res.blob()) as T;
  }

  if (responseType === "text") {
    return (await res.text()) as T;
  }

  if (responseType === "json") {
    return await parseJsonBody<T>(res);
  }

  const data = await parseResponseData(res);

  return data as T;
}
