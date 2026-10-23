import { Music } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Logo } from '../../components/Brand.tsx';
import { ThemeToggle } from '../../components/ThemeToggle.tsx';
import { socket } from '../../lib/socket.ts';
import { readStorage, storageKeys } from '../../lib/storage.ts';
import type { PlayerSession } from './PlayPage.tsx';

interface JoinFormProps {
  code: string;
  initialError: string;
  onJoined: (session: PlayerSession) => void;
}

export function JoinForm({ code, initialError, onJoined }: JoinFormProps) {
  const [name, setName] = useState(() => readStorage(storageKeys.lastName) ?? '');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    setName(event.target.value);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await socket.timeout(5000).emitWithAck('player:join', { code, name: trimmed });
      if (res.ok) onJoined({ name: trimmed, token: res.token });
      else setError(res.error);
    } catch {
      setError('Mạng chậm quá, thử lại nhé');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen center">
      <ThemeToggle floating />
      <Logo small />
      <form className="card stack" onSubmit={handleSubmit}>
        <p className="pill pill-dark">Phòng {code}</p>
        <label className="label" htmlFor="nickname">
          Tên của bạn
        </label>
        <input
          id="nickname"
          className="input"
          maxLength={20}
          autoComplete="nickname"
          placeholder="Ví dụ: Lan Ngọc"
          value={name}
          onChange={handleNameChange}
          autoFocus
        />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={!name.trim() || busy}>
          {busy ? (
            'Đang vào…'
          ) : (
            <>
              <Music /> Chơi thôi!
            </>
          )}
        </button>
      </form>
    </main>
  );
}
