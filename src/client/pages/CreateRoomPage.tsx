import { ArrowLeft, Gamepad2, Headphones, Users } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  DEFAULT_DURATION_SEC,
  DURATION_OPTIONS,
  type OwnerRoomInput,
  type PublicSetDto,
} from '../../shared/types.ts';
import { Logo } from '../components/Brand.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { socket } from '../lib/socket.ts';
import { readStorage, storageKeys, writeJson, writeStorage } from '../lib/storage.ts';

type Audio = OwnerRoomInput['audio'];

const AUDIO_OPTIONS: { value: Audio; icon: typeof Users; title: string; hint: string }[] = [
  { value: 'owner', icon: Users, title: 'Chơi gần nhau', hint: 'Chỉ máy của bạn phát nhạc, mọi người cùng nghe.' },
  { value: 'everyone', icon: Headphones, title: 'Chơi từ xa', hint: 'Máy nào cũng tự phát nhạc.' },
];

/** A player opens a room with one of the public sets, and becomes its owner. */
export function CreateRoomPage() {
  const [sets, setSets] = useState<PublicSetDto[] | null>(null);
  const [setId, setSetId] = useState('');
  const [name, setName] = useState(() => readStorage(storageKeys.lastName) ?? '');
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [audio, setAudio] = useState<Audio>('owner');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/public-sets')
      .then((res) => res.json() as Promise<PublicSetDto[]>)
      .then((list) => {
        setSets(list);
        setSetId(list[0]?.id ?? '');
      })
      .catch(() => {
        setSets([]);
        setError('Không tải được danh sách bộ đề, thử lại nhé');
      });
  }, []);

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    setName(event.target.value);
  }

  function handleSetChange(event: ChangeEvent<HTMLSelectElement>) {
    setSetId(event.target.value);
  }

  function handleDurationChange(event: ChangeEvent<HTMLSelectElement>) {
    setDurationSec(Number(event.target.value));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !setId || busy) return;
    setBusy(true);
    try {
      const res = await socket.timeout(5000).emitWithAck('owner:create', { setId, name: trimmed, durationSec, audio });
      if (!res.ok) return setError(res.error);
      writeJson(storageKeys.player(res.code), { name: trimmed, token: res.token });
      writeStorage(storageKeys.host(res.code), res.hostToken);
      writeStorage(storageKeys.lastName, trimmed);
      navigate(`/play/${res.code}`);
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
        <h2>Tạo phòng</h2>
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
        />
        <label className="label" htmlFor="owner-set">
          Bộ đề
        </label>
        {sets?.length === 0 ? (
          <p className="muted">Chưa có bộ đề nào mở cho mọi người.</p>
        ) : (
          <select id="owner-set" className="input" value={setId} onChange={handleSetChange} disabled={!sets}>
            {sets?.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} ({set.questionCount} câu)
              </option>
            ))}
          </select>
        )}
        <label className="label" htmlFor="owner-duration">
          Thời gian mỗi câu
        </label>
        <select id="owner-duration" className="input" value={durationSec} onChange={handleDurationChange}>
          {DURATION_OPTIONS.map((sec) => (
            <option key={sec} value={sec}>
              {sec} giây
            </option>
          ))}
        </select>
        <div className="audio-options" role="radiogroup" aria-label="Cách chơi">
          {AUDIO_OPTIONS.map((option) => (
            <AudioChoice key={option.value} {...option} checked={audio === option.value} onPick={setAudio} />
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={!name.trim() || !setId || busy}>
          <Gamepad2 /> {busy ? 'Đang tạo…' : 'Tạo phòng'}
        </button>
      </form>
      <Link to="/" className="link-subtle">
        <ArrowLeft /> Về trang chủ
      </Link>
    </main>
  );
}

interface AudioChoiceProps {
  value: Audio;
  icon: typeof Users;
  title: string;
  hint: string;
  checked: boolean;
  onPick: (value: Audio) => void;
}

function AudioChoice({ value, icon: Icon, title, hint, checked, onPick }: AudioChoiceProps) {
  function handlePick() {
    onPick(value);
  }

  return (
    <button type="button" role="radio" aria-checked={checked} className="audio-option" onClick={handlePick}>
      <Icon />
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
    </button>
  );
}
