import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from "./browser-storage";

export const TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
const LOGIN_PATH = "/login";
const REDIRECT_LOCK_MS = 2000;
let isRedirectingToLogin = false;

type LoginRedirectRouter = {
  replace: (href: string) => void;
};

export function getAccessToken(): string | null {
  return readLocalStorage(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readLocalStorage(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  writeLocalStorage(TOKEN_KEY, accessToken);
  writeLocalStorage(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAuthTokens() {
  removeLocalStorage(TOKEN_KEY);
  removeLocalStorage(REFRESH_TOKEN_KEY);
}

export function redirectToLogin(router?: LoginRedirectRouter) {
  if (typeof window !== "undefined") {
    if (window.location.pathname === LOGIN_PATH) {
      return;
    }

    if (isRedirectingToLogin) {
      return;
    }

    isRedirectingToLogin = true;

    window.setTimeout(() => {
      isRedirectingToLogin = false;
    }, REDIRECT_LOCK_MS);
  }

  if (router) {
    router.replace(LOGIN_PATH);
    return;
  }

  if (typeof window !== "undefined") {
    window.location.assign(LOGIN_PATH);
  }
}

export function logoutAndRedirectToLogin(router?: LoginRedirectRouter) {
  clearAuthTokens();
  redirectToLogin(router);
}
