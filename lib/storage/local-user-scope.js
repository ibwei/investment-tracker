export const LOCAL_USER_SCOPE_KEY = "cefidefi-local-user-scope";
const GUEST_SCOPE = "guest";

function canUseBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getLocalUserScope() {
  if (!canUseBrowserStorage()) {
    return GUEST_SCOPE;
  }

  return window.localStorage.getItem(LOCAL_USER_SCOPE_KEY) || GUEST_SCOPE;
}

export function setLocalUserScope(scope) {
  if (!canUseBrowserStorage()) {
    return;
  }

  if (!scope) {
    window.localStorage.removeItem(LOCAL_USER_SCOPE_KEY);
    return;
  }

  window.localStorage.setItem(LOCAL_USER_SCOPE_KEY, String(scope));
}
