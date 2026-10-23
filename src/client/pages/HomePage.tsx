import { ArrowRight, LogIn } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Logo } from '../components/Brand.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { Link, navigate } from '../lib/router.tsx';

export function HomePage() {
  const [code, setCode] = useState('');

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value.replace(/\D/g, '').slice(0, 4));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.length === 4) navigate(`/play/${code}`);
  }

  return (
    <main className="screen center">
      <ThemeToggle floating />
      <Logo />
      <p className="tagline">Nghe lời – đoán tên bài hát!</p>
      <form className="card stack" onSubmit={handleSubmit}>
        <label className="label" htmlFor="room-code">
          Mã phòng
        </label>
        <input
          id="room-code"
          className="input input-code"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1234"
          value={code}
          onChange={handleCodeChange}
          autoFocus
        />
        <button className="btn btn-primary btn-lg" disabled={code.length !== 4}>
          <LogIn /> Vào phòng
        </button>
      </form>
      <Link to="/admin" className="link-subtle">
        Tôi là host <ArrowRight />
      </Link>
    </main>
  );
}
