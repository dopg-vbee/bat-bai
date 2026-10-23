import { Eye, Gamepad2 } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { DEFAULT_DURATION_SEC, DURATION_OPTIONS, PREVIEW_BOTS, type QuestionSetDto } from '../../../shared/types.ts';
import { createRoom } from '../../lib/rooms.ts';

export function CreateRoomPanel({ set }: { set: QuestionSetDto }) {
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [shuffle, setShuffle] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleDurationChange(event: ChangeEvent<HTMLSelectElement>) {
    setDurationSec(Number(event.target.value));
  }

  function handleShuffleChange(event: ChangeEvent<HTMLInputElement>) {
    setShuffle(event.target.checked);
  }

  async function start(preview: boolean) {
    setBusy(true);
    setError((await createRoom({ setId: set.id, durationSec, shuffle, preview })) ?? '');
    setBusy(false);
  }

  function handleCreate() {
    void start(false);
  }

  function handlePreview() {
    void start(true);
  }

  const disabled = busy || !set.questions.length;
  return (
    <div className="card create-room">
      <div className="create-room-options">
        <label className="field-inline">
          <span>Thời gian mỗi câu</span>
          <select className="input input-sm" value={durationSec} onChange={handleDurationChange}>
            {DURATION_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {sec} giây
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          <input type="checkbox" checked={shuffle} onChange={handleShuffleChange} />
          <span>Trộn thứ tự câu</span>
        </label>
      </div>
      <div className="create-room-actions">
        <button
          className="btn btn-ghost-dark btn-lg"
          onClick={handlePreview}
          disabled={disabled}
          title={`Chơi thử với ${PREVIEW_BOTS} bot, xem trước đúng như ván thật`}
        >
          <Eye /> Chơi thử
        </button>
        <button className="btn btn-primary btn-lg" onClick={handleCreate} disabled={disabled}>
          <Gamepad2 /> Tạo phòng chơi
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
