import { CircleAlert, Flag, ListOrdered, Pause, Play, QrCode, SkipForward, Trophy, WifiOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { socket, useConnected, useServerNow } from '../../lib/socket.ts';
import { storageKeys, writeStorage } from '../../lib/storage.ts';
import { useHostRoom } from './useHostRoom.ts';

/** The one big button: whatever moves the game on from where it is. */
function nextStep(state: HostState): { label: string; icon: ReactNode } | null {
  switch (state.phase) {
    case 'lobby':
      return { label: 'Bắt đầu', icon: <Play /> };
    case 'question':
      return { label: 'Hiện đáp án', icon: <SkipForward /> };
    case 'reveal':
      return { label: 'Xem bảng xếp hạng', icon: <ListOrdered /> };
    case 'leaderboard':
      return state.qIndex + 1 >= state.qTotal
        ? { label: 'Xem kết quả', icon: <Trophy /> }
        : { label: 'Câu tiếp', icon: <SkipForward /> };
    default:
      return null;
  }
}

function Status({ state }: { state: HostState }) {
  const running = state.phase === 'question' && !state.pausedAt;
  const now = useServerNow(running, 250);
  switch (state.phase) {
    case 'lobby':
      return <>{state.players.length} người đã vào phòng</>;
    case 'question': {
      const at = state.pausedAt || now;
      const timer = at < state.startsAt ? 'đang đếm ngược' : `còn ${Math.max(0, Math.ceil((state.endsAt - at) / 1000))} giây`;
      return (
        <>
          Câu {state.qIndex + 1}/{state.qTotal} · {timer} · {state.correctFeed.length}/{state.players.length} đúng
        </>
      );
    }
    case 'reveal':
      return <>Đáp án: {state.answer}</>;
    case 'leaderboard':
      return (
        <>
          Bảng xếp hạng sau câu {state.qIndex + 1}/{state.qTotal}
        </>
      );
    default:
      return <>Trò chơi đã kết thúc</>;
  }
}

/** The host token comes in the QR code's #fragment (never sent to the server): keep it, then hide it. */
function takeTokenFromUrl(code: string) {
  const token = location.hash.slice(1);
  if (!token) return;
  writeStorage(storageKeys.host(code), token);
  history.replaceState(null, '', location.pathname);
}

/** Phone remote for the host: run the game from anywhere in the room. */
export function RemotePage({ code }: { code: string }) {
  // Before the first render, so useHostRoom already finds the token.
  useState(() => takeTokenFromUrl(code));
  const { state, error } = useHostRoom(code);
  const connected = useConnected();

  if (error) {
    return (
      <main className="screen center">
        <div className="card stack text-center">
          <StatusBadge icon={CircleAlert} tone="danger" />
          <h2>{error}</h2>
          <p className="muted">Quét lại mã "Điều khiển bằng điện thoại" trong menu của màn hình host.</p>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="screen center">
        <div className="spinner" />
      </main>
    );
  }

  const step = nextStep(state);
  const paused = Boolean(state.pausedAt);
  const pausable = ['question', 'reveal', 'leaderboard'].includes(state.phase);
  const inGame = state.phase !== 'lobby' && state.phase !== 'ended';

  function handleNext() {
    socket.emit('host:next');
  }

  function handleTogglePause() {
    socket.emit(paused ? 'host:resume' : 'host:pause');
  }

  function handleToggleQr() {
    socket.emit('host:joinQr', !state?.joinQr);
  }

  function handleEnd() {
    if (confirm('Kết thúc trò chơi ngay và xem kết quả?')) socket.emit('host:end');
  }

  return (
    <main className="screen remote-screen">
      <header className="remote-head">
        <h1>Điều khiển phòng {code}</h1>
        <p className="remote-status">
          {paused ? 'Đang tạm dừng · ' : ''}
          <Status state={state} />
        </p>
      </header>
      {!connected && (
        <div className="banner">
          <WifiOff /> Mất kết nối tới server, đang nối lại…
        </div>
      )}
      <div className="remote-actions">
        {step && (
          <button
            className="btn btn-primary btn-xl"
            onClick={handleNext}
            disabled={state.phase === 'lobby' && !state.players.length}
          >
            {step.icon} {step.label}
          </button>
        )}
        {pausable && (
          <button className="btn btn-ghost btn-xl" onClick={handleTogglePause}>
            {paused ? <Play /> : <Pause />} {paused ? 'Tiếp tục' : 'Tạm dừng'}
          </button>
        )}
        {inGame && (
          <button className="btn btn-ghost btn-lg" onClick={handleToggleQr}>
            <QrCode /> {state.joinQr ? 'Ẩn mã QR vào phòng' : 'Hiện mã QR vào phòng'}
          </button>
        )}
        {state.phase !== 'ended' && (
          <button className="btn btn-danger btn-lg" onClick={handleEnd}>
            <Flag /> Kết thúc trò chơi
          </button>
        )}
      </div>
    </main>
  );
}
