import { SkipForward } from 'lucide-react';
import { useEffect } from 'react';
import { FINALE_MS, type HostState } from '../../../shared/types.ts';
import { AnimatedEmoji } from '../../components/Emoji.tsx';
import { playDrumroll } from '../../lib/sfx.ts';
import { socket } from '../../lib/socket.ts';
import { AdvanceBar } from './HostLeaderboard.tsx';

/** After the last answer: a beat that says the game is over and builds up to the final results. */
export function HostFinale({ state }: { state: HostState }) {
  useEffect(() => {
    playDrumroll(FINALE_MS / 1000);
  }, []);

  function handleSkip() {
    socket.emit('host:next');
  }

  return (
    <section className="host-finale">
      <AnimatedEmoji char="🏁" className="finale-flag" />
      <h2 className="finale-title">Trò chơi đã kết thúc!</h2>
      <p className="finale-sub">Chuẩn bị tổng kết điểm…</p>
      <AdvanceBar advanceAt={state.advanceAt} pausedAt={state.pausedAt} durationMs={FINALE_MS} />
      <button
        className="btn btn-ghost icon-btn skip-btn"
        onClick={handleSkip}
        aria-label="Xem kết quả"
        title="Xem kết quả"
      >
        <SkipForward />
      </button>
    </section>
  );
}
