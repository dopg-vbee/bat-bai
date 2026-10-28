import { SkipForward } from 'lucide-react';
import { LEADERBOARD_MS, type HostState } from '../../../shared/types.ts';
import { AnimatedLeaderboard } from '../../components/AnimatedLeaderboard.tsx';
import { teamRows } from '../../components/Team.tsx';
import { socket, useServerNow } from '../../lib/socket.ts';

/** Ticks on its own so the list above isn't re-rendered ten times a second. */
interface AdvanceBarProps {
  advanceAt: number;
  pausedAt: number;
  /** How long the wait lasts, for the bar to drain over. */
  durationMs?: number;
}

export function AdvanceBar({ advanceAt, pausedAt, durationMs = LEADERBOARD_MS }: AdvanceBarProps) {
  // While paused the clock stands still at the moment the host paused.
  const live = useServerNow(!pausedAt, 100);
  const remaining = Math.max(0, advanceAt - (pausedAt || live));
  return (
    <div className="advance-bar">
      <div className="advance-bar-fill" style={{ width: `${(remaining / durationMs) * 100}%` }} />
    </div>
  );
}

/**
 * A few seconds between rounds: rank changes animate, then the next question starts by itself.
 * Not after the last question (see HostFinale).
 */
export function HostLeaderboard({ state }: { state: HostState }) {
  function handleNext() {
    socket.emit('host:next');
  }

  return (
    <section className="host-leaderboard">
      <p className="host-question-no">
        Sau câu {state.qIndex + 1}/{state.qTotal} · đáp án: <strong>{state.answer}</strong>
      </p>
      <h2 className="leaderboard-title">Bảng xếp hạng</h2>
      {/* Team play ranks the teams, in the same style as players. */}
      <AnimatedLeaderboard rows={state.teamMode === 'off' ? state.leaderboard : teamRows(state.teams)} />
      <AdvanceBar advanceAt={state.advanceAt} pausedAt={state.pausedAt} />
      <button
        className="btn btn-ghost icon-btn skip-btn"
        onClick={handleNext}
        aria-label="Câu tiếp"
        title="Câu tiếp"
      >
        <SkipForward />
      </button>
    </section>
  );
}
