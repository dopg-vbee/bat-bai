import { useEffect, useState } from 'react';
import { api, getAdminPassword, setAdminPassword } from '../../lib/api.ts';
import { AdminLogin } from './AdminLogin.tsx';
import { AdminLibrary } from './AdminLibrary.tsx';

type Status = 'checking' | 'login' | 'ready';

export function AdminPage() {
  const [status, setStatus] = useState<Status>(() => (getAdminPassword() ? 'checking' : 'login'));

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
  return <AdminLibrary onLogout={handleLogout} />;
}
