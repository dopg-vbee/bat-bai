// localStorage can throw (private mode, blocked site data): every access is guarded.

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not persisted; the session still works until the tab closes.
  }
}

export function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(readStorage(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

export const writeJson = (key: string, value: unknown) => writeStorage(key, JSON.stringify(value));

export const storageKeys = {
  adminPassword: 'batbai:admin',
  lastName: 'batbai:name',
  player: (code: string) => `batbai:player:${code}`,
  host: (code: string) => `batbai:host:${code}`,
};
