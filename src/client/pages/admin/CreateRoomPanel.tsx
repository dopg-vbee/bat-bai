import { Eye, Gamepad2, TriangleAlert } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import {
  DEFAULT_DURATION_SEC,
  DURATION_OPTIONS,
  PREVIEW_BOT_OPTIONS,
  PREVIEW_BOTS,
  type QuestionSetDto,
} from '../../../shared/types.ts';
import { createRoom } from '../../lib/rooms.ts';

interface CreateRoomPanelProps {
  set: QuestionSetDto;
  /** Questions whose answer video won't play: worth fixing before a real game. */
  brokenVideos: number;
}

export function CreateRoomPanel({ set, brokenVideos }: CreateRoomPanelProps) {
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [shuffle, setShuffle] = useState(true);
  const [bots, setBots] = useState(PREVIEW_BOTS);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleDurationChange(event: ChangeEvent<HTMLSelectElement>) {
    setDurationSec(Number(event.target.value));
  }

  function handleShuffleChange(event: ChangeEvent<HTMLInputElement>) {
    setShuffle(event.target.checked);
  }

  function handleBotsChange(event: ChangeEvent<HTMLSelectElement>) {
    setBots(Number(event.target.value));
  }

  async function start(preview: boolean) {
    setBusy(true);
    setError((await createRoom({ setId: set.id, durationSec, shuffle, preview, bots })) ?? '');
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
        <label className="field-inline" title="Chỉ áp dụng cho Chơi thử; chọn 100 để thử tải">
          <span>Bot chơi thử</span>
          <select className="input input-sm" value={bots} onChange={handleBotsChange}>
            {PREVIEW_BOT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} bot
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="create-room-actions">
        <button
          className="btn btn-ghost-dark btn-lg"
          onClick={handlePreview}
          disabled={disabled}
          title={`Chơi thử với ${bots} bot, xem trước đúng như ván thật`}
        >
          <Eye /> Chơi thử
        </button>
        <button className="btn btn-primary btn-lg" onClick={handleCreate} disabled={disabled}>
          <Gamepad2 /> Tạo phòng chơi
        </button>
      </div>
      {brokenVideos > 0 && (
        <p className="video-problem">
          <TriangleAlert /> {brokenVideos} câu có video không phát được: người chơi sẽ không xem được đáp án
          của các câu đó.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
