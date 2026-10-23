import { ArrowLeft, CircleAlert, Pause, Play, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BrandMark } from '../../components/Brand.tsx';
import { preloadAnimatedEmoji } from '../../components/Emoji.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { Link } from '../../lib/router.tsx';
import { socket, useConnected } from '../../lib/socket.ts';
import { HostClip } from './HostClip.tsx';
import { HostEnded } from './HostEnded.tsx';
import { HostLeaderboard } from './HostLeaderboard.tsx';
import { HostLobby } from './HostLobby.tsx';
import { HostMenu } from './HostMenu.tsx';
import { HostQuestion } from './HostQuestion.tsx';
import { HostReveal } from './HostReveal.tsx';
import { JoinCard, QrOverlay, RemoteCard } from './JoinCard.tsx';
import { PauseOverlay } from './PauseOverlay.tsx';
import { useHostRoom } from './useHostRoom.ts';
import { useQuestionAudio } from './useQuestionAudio.ts';

export function HostPage({ code }: { code: string }) {
  const { state, error } = useHostRoom(code);
  const [videoSlot, setVideoSlot] = useState<HTMLElement | null>(null);
  const [showRemote, setShowRemote] = useState(false);
  const connected = useConnected();
  const audio = useQuestionAudio(state);
  const paused = Boolean(state?.pausedAt);
  const pausable = state !== null && ['question', 'reveal', 'leaderboard'].includes(state.phase);

  useEffect(() => {
    preloadAnimatedEmoji(['💯', '🏆', '🔥']);
  }, []);

  function handleTogglePause() {
    socket.emit(paused ? 'host:resume' : 'host:pause');
  }

  // The join QR lives on the server, so a phone remote can show and hide it too.
  function handleShowQr() {
    socket.emit('host:joinQr', true);
  }

  function handleHideQr() {
    socket.emit('host:joinQr', false);
  }

  function handleShowRemote() {
    setShowRemote(true);
  }

  function handleHideRemote() {
    setShowRemote(false);
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
        {/* Brand and set name only in the lobby; the game and the results get the whole screen. */}
        {state.phase === 'lobby' ? (
          <>
            <span className="host-brand">
              <BrandMark />
            </span>
            <span className="host-set">{state.setName}</span>
          </>
        ) : (
          <span className="host-set" />
        )}
        <HostMenu state={state} onEnd={handleEnd} onShowQr={handleShowQr} onShowRemote={handleShowRemote} />
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
      {state.joinQr && state.phase !== 'lobby' && state.phase !== 'ended' && (
        <QrOverlay onClose={handleHideQr}>
          <JoinCard code={state.code} />
        </QrOverlay>
      )}
      {showRemote && (
        <QrOverlay onClose={handleHideRemote}>
          <RemoteCard code={state.code} />
        </QrOverlay>
      )}
      {paused && <PauseOverlay onResume={handleTogglePause} />}
    </main>
  );
}
