import { ArrowLeft, CircleAlert, Pause, Play, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { reactionAnimationUrl } from '../../../shared/emoji.ts';
import { REACTIONS } from '../../../shared/types.ts';
import { BrandMark } from '../../components/Brand.tsx';
import { Overlay } from '../../components/Overlay.tsx';
import { preloadAnimatedEmoji } from '../../components/Emoji.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { Link } from '../../lib/router.tsx';
import { useLingering } from '../../lib/useLingering.ts';
import { socket, useConnected } from '../../lib/socket.ts';
import { HostClip } from './HostClip.tsx';
import { HostEnded } from './HostEnded.tsx';
import { HostFinale } from './HostFinale.tsx';
import { HostLeaderboard } from './HostLeaderboard.tsx';
import { HostLobby } from './HostLobby.tsx';
import { HostMenu } from './HostMenu.tsx';
import { HostQuestion } from './HostQuestion.tsx';
import { HostReveal } from './HostReveal.tsx';
import { JoinCard, RemoteCard } from './JoinCard.tsx';
import { PauseOverlay } from './PauseOverlay.tsx';
import { ReactionLayer } from './ReactionLayer.tsx';
import { useHostRoom } from './useHostRoom.ts';
import { useQuestionAudio } from './useQuestionAudio.ts';

/** At least the .host-clip.closing animation (0.3 s), plus slack for the render. */
const CLIP_EXIT_MS = 600;

export function HostPage({ code }: { code: string }) {
  const { state, error } = useHostRoom(code);
  const [videoSlot, setVideoSlot] = useState<HTMLElement | null>(null);
  const [showRemote, setShowRemote] = useState(false);
  const connected = useConnected();
  const audio = useQuestionAudio(state);
  // The answer video lives from the question (pre-buffering) to the end of the reveal, and fades out.
  const roundClip = state?.clip ? { qIndex: state.qIndex, clip: state.clip, title: state.answer ?? '' } : null;
  const { value: clip, leaving: clipLeaving } = useLingering(roundClip, CLIP_EXIT_MS);
  const paused = Boolean(state?.pausedAt);
  const pausable = state !== null && ['question', 'reveal', 'leaderboard', 'finale'].includes(state.phase);

  useEffect(() => {
    preloadAnimatedEmoji(['💯', '🏆', '🔥']);
    // So the first reactions fly in already moving.
    for (const emoji of REACTIONS) new Image().src = reactionAnimationUrl(emoji);
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
      {state.phase === 'finale' && <HostFinale state={state} />}
      {state.phase === 'ended' && <HostEnded state={state} />}
      {clip && (
        <HostClip
          key={`clip-${clip.qIndex}`}
          qIndex={clip.qIndex}
          paused={paused}
          clip={clip.clip}
          title={clip.title}
          active={state.phase === 'reveal'}
          closing={clipLeaving}
          slot={videoSlot}
        />
      )}
      {state.joinQr && state.phase !== 'lobby' && state.phase !== 'ended' && (
        <Overlay onClose={handleHideQr}>
          <JoinCard code={state.code} />
        </Overlay>
      )}
      {showRemote && (
        <Overlay onClose={handleHideRemote}>
          <RemoteCard code={state.code} />
        </Overlay>
      )}
      {state.phase !== 'lobby' && <ReactionLayer code={state.code} />}
      {paused && <PauseOverlay onResume={handleTogglePause} />}
    </main>
  );
}
