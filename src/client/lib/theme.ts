import { useSyncExternalStore } from 'react';
import { readStorage, storageKeys, writeStorage } from './storage.ts';

type Theme = 'dark' | 'light';

// Matches the theme-color meta / first paint set by the inline script in index.html.
const BROWSER_BAR_COLOR: Record<Theme, string> = { dark: '#0c0a18', light: '#6d28d9' };
const listeners = new Set<() => void>();

const current = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR_COLOR[theme]);
  listeners.forEach((listener) => listener());
}

// Another tab (e.g. the player window opened from the host screen) changed the theme.
window.addEventListener('storage', (event) => {
  if (event.key === storageKeys.theme) apply(event.newValue === 'light' ? 'light' : 'dark');
});

export function toggleTheme() {
  const next: Theme = current() === 'dark' ? 'light' : 'dark';
  writeStorage(storageKeys.theme, next);
  apply(next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const useTheme = () => useSyncExternalStore(subscribe, current);

// Sync the browser bar with what the inline script already applied.
apply(readStorage(storageKeys.theme) === 'light' ? 'light' : 'dark');
