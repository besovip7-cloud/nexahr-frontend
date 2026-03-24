import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.getnexhr.com/api";

type ApiRequestOptions = RequestInit & {
  auth?: boolean;
};

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await res.json();

    if (!res.ok || !data?.access_token) {
      clearAuthTokens();
      return null;
    }

    const nextRefreshToken = data?.refresh_token || refreshToken;
    setAuthTokens(data.access_token, nextRefreshToken);

    return data.access_token;
  } catch {
    clearAuthTokens();
    return null;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { auth = true, headers, body, ...rest } = options;

  let accessToken = auth ? getAccessToken() : null;

  const makeRequest = async (token?: string | null) => {
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      cache: "no-store",
    });
  };

  let res = await makeRequest(accessToken);

  if (auth && res.status === 401) {
    const newAccessToken = await refreshAccessToken();

    if (!newAccessToken) {
      clearAuthTokens();

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }

      throw new Error("Unauthorized");
    }

    res = await makeRequest(newAccessToken);
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const errorMessage =
      typeof data === "object" && data?.message
        ? Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message
        : "Request failed";

    throw new Error(errorMessage);
  }

  return data as T;
}