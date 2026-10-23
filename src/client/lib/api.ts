import { readStorage, storageKeys, writeStorage } from './storage.ts';

export const getAdminPassword = () => readStorage(storageKeys.adminPassword) ?? '';
export const setAdminPassword = (password: string | null) => writeStorage(storageKeys.adminPassword, password);

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-admin-password': encodeURIComponent(getAdminPassword()) };
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/admin${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Có lỗi xảy ra, thử lại nhé');
  return data as T;
}
