export const HERMES_ACCESS_HEADER = "x-hermes-access-key";
export const HERMES_ACCESS_STORAGE_KEY = "hermes_access_key";

export function getStoredHermesAccessKey(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    sessionStorage.getItem(HERMES_ACCESS_STORAGE_KEY) ||
    localStorage.getItem(HERMES_ACCESS_STORAGE_KEY)
  );
}

export function storeHermesAccessKey(key: string): void {
  const trimmed = key.trim();

  sessionStorage.setItem(HERMES_ACCESS_STORAGE_KEY, trimmed);
  localStorage.setItem(HERMES_ACCESS_STORAGE_KEY, trimmed);
}

export function clearStoredHermesAccessKey(): void {
  sessionStorage.removeItem(HERMES_ACCESS_STORAGE_KEY);
  localStorage.removeItem(HERMES_ACCESS_STORAGE_KEY);
}

export function getHermesAccessHeaders(): HeadersInit {
  const key = getStoredHermesAccessKey();

  if (!key) {
    return {};
  }

  return {
    [HERMES_ACCESS_HEADER]: key,
  };
}
