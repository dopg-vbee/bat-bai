import { usePath } from './lib/router.tsx';
import { AdminPage } from './pages/admin/AdminPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { HostPage } from './pages/host/HostPage.tsx';
import { PlayPage } from './pages/play/PlayPage.tsx';

export function App() {
  const path = usePath();
  const host = /^\/host\/(\d{4})\/?$/.exec(path);
  const play = /^\/play\/(\d{4})\/?$/.exec(path);
  if (path.startsWith('/admin')) return <AdminPage />;
  if (host) return <HostPage key={host[1]} code={host[1]} />;
  if (play) return <PlayPage key={play[1]} code={play[1]} />;
  return <HomePage />;
}
