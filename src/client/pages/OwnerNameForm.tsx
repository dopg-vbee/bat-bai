import { Gamepad2 } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { DEFAULT_DURATION_SEC, type PublicSetDto } from '../../shared/types.ts';
import { navigate } from '../lib/router.tsx';
import { socket } from '../lib/socket.ts';
import { readStorage, storageKeys, writeJson, writeStorage } from '../lib/storage.ts';

const WIDE_SCREEN = '(min-width: 1000px)';

/** Opens a room with `set`: the owner only gives a name (20 s a question, every phone plays the audio). */
export function OwnerNameForm({ set }: { set: PublicSetDto }) {
  const [name, setName] = useState(() => readStorage(storageKeys.lastName) ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    setName(event.target.value);
    setError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const input = { setId: set.id, name: trimmed, durationSec: DEFAULT_DURATION_SEC, audio: 'everyone' } as const;
      const res = await socket.timeout(5000).emitWithAck('owner:create', input);
      if (!res.ok) return setError(res.error);
      writeJson(storageKeys.player(res.code), { name: trimmed, token: res.token });
      writeStorage(storageKeys.host(res.code), res.hostToken);
      writeStorage(storageKeys.lastName, trimmed);
      // A computer gets the big-screen view (the owner plays from a window it opens); a phone gets the player page.
      navigate(window.matchMedia(WIDE_SCREEN).matches ? `/host/${res.code}` : `/play/${res.code}`);
    } catch {
      setError('Mạng chậm quá, thử lại nhé');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack owner-name-form" onSubmit={handleSubmit}>
      <h2>{set.name}</h2>
      <p className="muted">{set.questionCount} câu</p>
      <label className="label" htmlFor="owner-name">
        Tên của bạn
      </label>
      <input
        id="owner-name"
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
        <Gamepad2 /> {busy ? 'Đang tạo…' : 'Tạo phòng'}
      </button>
    </form>
  );
}
