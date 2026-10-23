import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';

const listeners = new Set<() => void>();
window.addEventListener('popstate', () => listeners.forEach((listener) => listener()));

export function navigate(to: string) {
  history.pushState(null, '', to);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const getPath = () => location.pathname;

export const usePath = () => useSyncExternalStore(subscribe, getPath);

export function Link({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  }
  return (
    <a href={to} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
