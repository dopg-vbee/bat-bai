import { lazy, Suspense } from 'react';
import { usePath } from './lib/router.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { PlayPage } from './pages/play/PlayPage.tsx';

// Phones only need the home and play pages; the admin and big-screen code loads on demand.
const AdminPage = lazy(() => import('./pages/admin/AdminPage.tsx').then((m) => ({ default: m.AdminPage })));
const HostPage = lazy(() => import('./pages/host/HostPage.tsx').then((m) => ({ default: m.HostPage })));

const loading = (
  <main className="screen center">
    <div className="spinner" />
  </main>
);

export function App() {
  const path = usePath();
  const host = /^\/host\/(\d{4})\/?$/.exec(path);
  const play = /^\/play\/(\d{4})\/?$/.exec(path);
  if (play) return <PlayPage key={play[1]} code={play[1]} />;
  if (!host && !path.startsWith('/admin')) return <HomePage />;
  return <Suspense fallback={loading}>{host ? <HostPage key={host[1]} code={host[1]} /> : <AdminPage />}</Suspense>;
}
