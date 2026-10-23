import { ArrowLeft, CircleAlert, Eye, Flag, Users, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { BrandMark } from '../../components/Brand.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { Link } from '../../lib/router.tsx';
import { socket, useConnected } from '../../lib/socket.ts';
import { readStorage, storageKeys } from '../../lib/storage.ts';
import { HostClip } from './HostClip.tsx';
import { HostEnded } from './HostEnded.tsx';
import { HostLeaderboard } from './HostLeaderboard.tsx';
import { HostLobby } from './HostLobby.tsx';
import { HostQuestion } from './HostQuestion.tsx';
import { HostReveal } from './HostReveal.tsx';
import { useQuestionAudio } from './useQuestionAudio.ts';

export function HostPage({ code }: { code: string }) {
  const [state, setState] = useState<HostState | null>(null);
  const [error, setError] = useState('');
  const [videoSlot, setVideoSlot] = useState<HTMLElement | null>(null);
  const connected = useConnected();
  const audio = useQuestionAudio(state);

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
    socket.on('hostState', setState);
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('hostState', setState);
      socket.off('connect', join);
    };
  }, [code]);

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
        <span className="host-brand">
          <BrandMark />
        </span>
        <span className="host-set">{state.setName}</span>
        {state.preview && (
          <>
            <span className="pill pill-preview">
              <Eye /> Chơi thử
            </span>
            <Link to="/admin" className="btn btn-ghost btn-sm">
              <ArrowLeft /> Quản lý
            </Link>
          </>
        )}
        <span className="pill">Phòng {state.code}</span>
        <span className="pill">
          <Users /> {state.players.filter((p) => p.connected).length}
        </span>
        {state.phase !== 'ended' && (
          <button className="btn btn-ghost btn-sm" onClick={handleEnd}>
            <Flag /> Kết thúc
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
          clip={state.clip}
          title={state.answer ?? ''}
          active={state.phase === 'reveal'}
          slot={videoSlot}
        />
      )}
    </main>
  );
}
