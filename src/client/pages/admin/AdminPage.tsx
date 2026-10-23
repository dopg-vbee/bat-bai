import { useEffect, useState } from 'react';
import { api, getAdminPassword, setAdminPassword } from '../../lib/api.ts';
import { usePath } from '../../lib/router.tsx';
import { AdminLogin } from './AdminLogin.tsx';
import { SetListPage } from './SetListPage.tsx';
import { SetPage } from './SetPage.tsx';

type Status = 'checking' | 'login' | 'ready';

export function AdminPage() {
  const [status, setStatus] = useState<Status>(() => (getAdminPassword() ? 'checking' : 'login'));
  const path = usePath();
  const setRoute = /^\/admin\/sets\/([\w-]+)\/?$/.exec(path);

  useEffect(() => {
    if (status !== 'checking') return;
    api('/login', { method: 'POST' })
      .then(() => setStatus('ready'))
      .catch(() => {
        setAdminPassword(null);
        setStatus('login');
      });
  }, [status]);

  function handleLoggedIn() {
    setStatus('ready');
  }

  function handleLogout() {
    setAdminPassword(null);
    setStatus('login');
  }

  if (status === 'checking') {
    return (
      <main className="screen center">
        <div className="spinner" />
      </main>
    );
  }
  if (status === 'login') return <AdminLogin onLoggedIn={handleLoggedIn} />;
  if (setRoute) return <SetPage key={setRoute[1]} setId={setRoute[1]} onLogout={handleLogout} />;
  return <SetListPage onLogout={handleLogout} />;
}
