import { ArrowLeft, DoorOpen, Pause, Users, Volume2, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TEAMS, type PlayerState } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Emoji, EmojiText, preloadAnimatedEmoji } from '../../components/Emoji.tsx';
import { OnFire } from '../../components/Fire.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { ThemeToggle } from '../../components/ThemeToggle.tsx';
import { formatPoints } from '../../lib/format.ts';
import { Link } from '../../lib/router.tsx';
import { useQuestionAudio } from '../../lib/useQuestionAudio.ts';
import { socket, useConnected } from '../../lib/socket.ts';
import { readJson, storageKeys, writeJson, writeStorage } from '../../lib/storage.ts';
import { JoinForm } from './JoinForm.tsx';
import { PlayerEnded } from './PlayerEnded.tsx';
import { PlayerFinale } from './PlayerFinale.tsx';
import { PlayerQuestion } from './PlayerQuestion.tsx';
import { PlayerReveal } from './PlayerReveal.tsx';
import { ReactionBar } from './ReactionBar.tsx';
import { TeamPicker } from './TeamPicker.tsx';

/** Animated emoji shown on correct/missed answers and the podium (see PlayerQuestion/Reveal/Ended). */
const CELEBRATIONS = ['🎉', '🎁', '🥳', '😅', '🏆'];

export interface PlayerSession {
  name: string;
  token: string;
}

export function PlayPage({ code }: { code: string }) {
  const [session, setSession] = useState(() => readJson<PlayerSession>(storageKeys.player(code)));
  const [state, setState] = useState<PlayerState | null>(null);
  const [error, setError] = useState('');
  const [kicked, setKicked] = useState(false);
  const connected = useConnected();
  // Only phones the server picked (see AudioMode) get an audio URL; for the others this does nothing.
  const audio = useQuestionAudio(state);
  const playsAudio = Boolean(state?.audioUrl ?? state?.nextAudioUrl);

  useEffect(() => {
    const handleKicked = () => {
      writeStorage(storageKeys.player(code), null);
      setKicked(true);
    };
    // Only this room: the socket is shared across pages and may still hear an earlier room.
    const onState = (next: PlayerState) => {
      if (next.code === code) setState(next);
    };
    socket.on('playerState', onState);
    socket.on('kicked', handleKicked);
    return () => {
      socket.off('playerState', onState);
      socket.off('kicked', handleKicked);
      socket.emit('player:leave');
    };
  }, [code]);

  useEffect(() => {
    preloadAnimatedEmoji(CELEBRATIONS, { once: true });
  }, []);

  // Rejoin with the saved token on every (re)connect: phones sleep and drop sockets often.
  useEffect(() => {
    if (!session) return;
    const rejoin = () =>
      socket.emit('player:join', { code, name: session.name, token: session.token }, (res) => {
        if (res.ok) return;
        writeStorage(storageKeys.player(code), null);
        setSession(null);
        setError(res.error);
      });
    if (socket.connected) rejoin();
    socket.on('connect', rejoin);
    return () => void socket.off('connect', rejoin);
  }, [code, session]);

  function handleJoined(next: PlayerSession) {
    writeJson(storageKeys.player(code), next);
    writeStorage(storageKeys.lastName, next.name);
    setError('');
    setSession(next);
  }

  if (kicked) {
    return (
      <main className="screen center">
        <div className="card stack text-center">
          <StatusBadge icon={DoorOpen} />
          <h2>Bạn đã bị mời ra khỏi phòng</h2>
          <Link to="/" className="btn btn-primary">
            <ArrowLeft /> Về trang chủ
          </Link>
        </div>
      </main>
    );
  }

  if (!session) return <JoinForm code={code} initialError={error} onJoined={handleJoined} />;

  if (!state) {
    return (
      <main className="screen center">
        <div className="spinner" />
        <p className="muted-light">Đang vào phòng {code}…</p>
      </main>
    );
  }

  return (
    <main className="screen player-screen">
      <header className="player-bar">
        <OnFire streak={state.round.streak}>
          <Avatar avatar={state.me.avatar} color={state.me.color} size="sm" />
        </OnFire>
        <strong className="player-bar-name">
          {state.me.name} {state.me.team !== null && <Emoji char={TEAMS[state.me.team].emoji} />}
        </strong>
        <span className="player-bar-score">{formatPoints(state.me.score)} điểm</span>
        <ThemeToggle />
      </header>
      {!connected && (
        <div className="banner">
          <WifiOff /> Mất kết nối, đang nối lại…
        </div>
      )}
      {state.pausedAt > 0 && (
        <div className="banner banner-pause">
          <Pause /> Host đang tạm dừng
        </div>
      )}
      {playsAudio && !audio.unlocked && state.phase !== 'ended' && (
        // Browsers only let a page play sound after a tap: do it before the first question.
        <button className="btn btn-primary banner-btn" onClick={audio.blocked ? audio.replay : audio.unlock}>
          <Volume2 /> Bấm để bật âm thanh
        </button>
      )}
      {state.phase === 'lobby' && (
        <section className="player-body center">
          <Emoji char={state.me.avatar} className="emoji-xl bounce" />
          <h2>Bạn đã vào phòng!</h2>
          <p className="muted-light">
            <EmojiText text="Nhìn lên màn hình lớn và chờ host bắt đầu nhé 👀" />
          </p>
          <p className="pill">
            <Users /> {state.playerCount} người chơi
          </p>
          {state.teams && <TeamPicker teams={state.teams} mine={state.me.team} />}
        </section>
      )}
      {state.phase === 'question' && <PlayerQuestion key={state.qIndex} state={state} />}
      {(state.phase === 'reveal' || state.phase === 'leaderboard') && <PlayerReveal key={state.qIndex} state={state} />}
      {state.phase === 'finale' && <PlayerFinale />}
      {state.phase === 'ended' && <PlayerEnded state={state} />}
      {/* Same rule as the server: once answered, or while the answer and ranking are shown. */}
      {((state.phase === 'question' && state.round.correct) ||
        state.phase === 'reveal' ||
        state.phase === 'leaderboard' ||
        state.phase === 'finale') && <ReactionBar />}
    </main>
  );
}
