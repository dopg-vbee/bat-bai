import { SkipForward, Trophy } from 'lucide-react';
import { LEADERBOARD_MS, type HostState } from '../../../shared/types.ts';
import { AnimatedLeaderboard } from '../../components/AnimatedLeaderboard.tsx';
import { socket, useServerNow } from '../../lib/socket.ts';

/** A few seconds between rounds: rank changes animate, then the next question starts by itself. */
export function HostLeaderboard({ state }: { state: HostState }) {
  // While paused the clock stands still at the moment the host paused.
  const live = useServerNow(!state.pausedAt, 100);
  const now = state.pausedAt || live;
  const isLast = state.qIndex + 1 >= state.qTotal;
  const remaining = Math.max(0, state.advanceAt - now);

  function handleNext() {
    socket.emit('host:next');
  }

  return (
    <section className="host-leaderboard">
      <p className="host-question-no">
        Sau câu {state.qIndex + 1}/{state.qTotal} · đáp án: <strong>{state.answer}</strong>
      </p>
      <h2 className="leaderboard-title">Bảng xếp hạng</h2>
      <AnimatedLeaderboard rows={state.leaderboard} />
      <div className="advance-bar">
        <div className="advance-bar-fill" style={{ width: `${(remaining / LEADERBOARD_MS) * 100}%` }} />
      </div>
      <button
        className="btn btn-ghost icon-btn skip-btn"
        onClick={handleNext}
        aria-label={isLast ? 'Xem kết quả' : 'Câu tiếp'}
        title={isLast ? 'Xem kết quả' : 'Câu tiếp'}
      >
        {isLast ? <Trophy /> : <SkipForward />}
      </button>
    </section>
  );
}
