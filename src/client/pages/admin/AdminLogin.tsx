import { ArrowLeft, LogIn } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Logo } from '../../components/Brand.tsx';
import { ThemeToggle } from '../../components/ThemeToggle.tsx';
import { api, setAdminPassword } from '../../lib/api.ts';
import { Link } from '../../lib/router.tsx';

export function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAdminPassword(password);
    try {
      await api('/login', { method: 'POST' });
      onLoggedIn();
    } catch (err) {
      setAdminPassword(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen center">
      <ThemeToggle floating />
      <Logo small />
      <form className="card stack" onSubmit={handleSubmit}>
        <h2>Khu vực host</h2>
        <label className="label" htmlFor="admin-password">
          Mật khẩu quản trị
        </label>
        <input
          id="admin-password"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={handlePasswordChange}
          autoFocus
        />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={!password || busy}>
          <LogIn /> Đăng nhập
        </button>
      </form>
      <Link to="/" className="link-subtle">
        <ArrowLeft /> Trang người chơi
      </Link>
    </main>
  );
}
