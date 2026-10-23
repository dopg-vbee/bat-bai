import { ArrowRight, Trophy } from 'lucide-react';
import { LEADERBOARD_MS, type HostState } from '../../../shared/types.ts';
import { AnimatedLeaderboard } from '../../components/AnimatedLeaderboard.tsx';
import { socket, useServerNow } from '../../lib/socket.ts';

/** A few seconds between rounds: rank changes animate, then the next question starts by itself. */
export function HostLeaderboard({ state }: { state: HostState }) {
  const now = useServerNow(true, 100);
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
      <button className="btn btn-ghost btn-sm skip-btn" onClick={handleNext}>
        {isLast ? (
          <>
            <Trophy /> Xem kết quả
          </>
        ) : (
          <>
            Câu tiếp ngay <ArrowRight />
          </>
        )}
      </button>
    </section>
  );
}
