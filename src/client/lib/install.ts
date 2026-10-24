import { useSyncExternalStore } from 'react';

/** Chrome's "install this app" event (not in the DOM typings). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function set(event: InstallPromptEvent | null) {
  deferred = event;
  listeners.forEach((listener) => listener());
}

// Chrome fires this once, early on page load (whatever page is open): keep it for the home page's button
// instead of Chrome's own mini-bar.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  set(event as InstallPromptEvent);
});
window.addEventListener('appinstalled', () => set(null));

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The browser can install the app with one tap (Chrome on Android and desktop). */
export const useCanInstall = () => useSyncExternalStore(subscribe, () => deferred !== null);

export function promptInstall() {
  void deferred?.prompt();
  set(null); // a prompt can only be shown once
}

/** iPhone / iPad not yet opened from the home screen: installing is by hand (Share → Add to Home Screen). */
export const needsIosInstallHint = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone;
