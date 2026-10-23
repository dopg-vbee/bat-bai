import { ArrowLeft, CircleAlert, Pause, Play, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { BrandMark } from '../../components/Brand.tsx';
import { preloadAnimatedEmoji } from '../../components/Emoji.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { Link } from '../../lib/router.tsx';
import { socket, useConnected } from '../../lib/socket.ts';
import { readStorage, storageKeys } from '../../lib/storage.ts';
import { HostClip } from './HostClip.tsx';
import { HostEnded } from './HostEnded.tsx';
import { HostLeaderboard } from './HostLeaderboard.tsx';
import { HostLobby } from './HostLobby.tsx';
import { HostMenu } from './HostMenu.tsx';
import { HostQuestion } from './HostQuestion.tsx';
import { HostReveal } from './HostReveal.tsx';
import { QrOverlay } from './JoinCard.tsx';
import { PauseOverlay } from './PauseOverlay.tsx';
import { useQuestionAudio } from './useQuestionAudio.ts';

export function HostPage({ code }: { code: string }) {
  const [state, setState] = useState<HostState | null>(null);
  const [error, setError] = useState('');
  const [videoSlot, setVideoSlot] = useState<HTMLElement | null>(null);
  const [showQr, setShowQr] = useState(false);
  const connected = useConnected();
  const audio = useQuestionAudio(state);
  const paused = Boolean(state?.pausedAt);
  const pausable = state !== null && ['question', 'reveal', 'leaderboard'].includes(state.phase);

  useEffect(() => {
    preloadAnimatedEmoji(['💯', '🏆']);
  }, []);

  useEffect(() => {
    const hostToken = readStorage(storageKeys.host(code));
    if (!hostToken) {
      setError('Trình duyệt này không phải host của phòng ' + code);
      return;
    }
    const join = () =>
      socket.emit('host:join', { code, hostToken }, (res) => {
        if (!res.ok) setError(res.error);
      });
    // Only this room: the socket is shared across pages and may still hear an earlier room.
    const onState = (next: HostState) => {
      if (next.code === code) setState(next);
    };
    socket.on('hostState', onState);
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('hostState', onState);
      socket.off('connect', join);
      socket.emit('host:leave');
    };
  }, [code]);

  function handleTogglePause() {
    socket.emit(paused ? 'host:resume' : 'host:pause');
  }

  function handleShowQr() {
    setShowQr(true);
  }

  function handleHideQr() {
    setShowQr(false);
  }

  function handleEnd() {
    if (confirm('Kết thúc trò chơi ngay và xem kết quả?')) socket.emit('host:end');
  }

  if (error) {
    return (
      <main className="screen center">
        <div className="card stack text-center">
          <StatusBadge icon={CircleAlert} tone="danger" />
          <h2>{error}</h2>
          <Link to="/admin" className="btn btn-primary">
            <ArrowLeft /> Về trang quản lý
          </Link>
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

  return (
    <main className="screen host-screen">
      <header className="host-bar">
        {/* Brand and set name only around the game (lobby, results), not while playing. */}
        {pausable ? (
          <span className="host-set" />
        ) : (
          <>
            <span className="host-brand">
              <BrandMark />
            </span>
            <span className="host-set">{state.setName}</span>
          </>
        )}
        <HostMenu state={state} onEnd={handleEnd} onShowQr={handleShowQr} />
        {pausable && (
          <button
            className="btn btn-ghost icon-btn pause-btn"
            onClick={handleTogglePause}
            aria-label={paused ? 'Tiếp tục' : 'Tạm dừng'}
            title={paused ? 'Tiếp tục' : 'Tạm dừng'}
          >
            {paused ? <Play /> : <Pause />}
          </button>
        )}
      </header>
      {!connected && (
        <div className="banner">
          <WifiOff /> Mất kết nối tới server, đang nối lại…
        </div>
      )}
      {state.phase === 'lobby' && <HostLobby state={state} />}
      {state.phase === 'question' && <HostQuestion state={state} audio={audio} />}
      {state.phase === 'reveal' && <HostReveal state={state} onVideoSlot={setVideoSlot} />}
      {state.phase === 'leaderboard' && <HostLeaderboard key={state.qIndex} state={state} />}
      {state.phase === 'ended' && <HostEnded state={state} />}
      {state.clip && (
        <HostClip
          key={state.qIndex}
          qIndex={state.qIndex}
          paused={paused}
          clip={state.clip}
          title={state.answer ?? ''}
          active={state.phase === 'reveal'}
          slot={videoSlot}
        />
      )}
      {showQr && state.phase !== 'ended' && <QrOverlay code={state.code} onClose={handleHideQr} />}
      {paused && <PauseOverlay onResume={handleTogglePause} />}
    </main>
  );
}
