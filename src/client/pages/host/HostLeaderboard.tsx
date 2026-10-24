import { SkipForward, Trophy } from 'lucide-react';
import { LEADERBOARD_MS, type HostState } from '../../../shared/types.ts';
import { AnimatedLeaderboard } from '../../components/AnimatedLeaderboard.tsx';
import { teamBarRows, TeamBars } from '../../components/Team.tsx';
import { socket, useServerNow } from '../../lib/socket.ts';

/** Ticks on its own so the list above isn't re-rendered ten times a second. */
function AdvanceBar({ advanceAt, pausedAt }: { advanceAt: number; pausedAt: number }) {
  // While paused the clock stands still at the moment the host paused.
  const live = useServerNow(!pausedAt, 100);
  const remaining = Math.max(0, advanceAt - (pausedAt || live));
  return (
    <div className="advance-bar">
      <div className="advance-bar-fill" style={{ width: `${(remaining / LEADERBOARD_MS) * 100}%` }} />
    </div>
  );
}

/** One row of team bars' height plus gap, and the gap under the bars: room the player list gives up. */
const TEAM_BAR_PITCH = 52;
const TEAM_BARS_GAP = 16;

/** A few seconds between rounds: rank changes animate, then the next question starts by itself. */
export function HostLeaderboard({ state }: { state: HostState }) {
  const isLast = state.qIndex + 1 >= state.qTotal;

  function handleNext() {
    socket.emit('host:next');
  }

  return (
    <section className="host-leaderboard">
      <p className="host-question-no">
        Sau câu {state.qIndex + 1}/{state.qTotal} · đáp án: <strong>{state.answer}</strong>
      </p>
      <h2 className="leaderboard-title">Bảng xếp hạng</h2>
      {state.teamMode === 'together' ? (
        // Teammates all score alike: the teams are the ranking.
        <TeamBars teams={state.teams} large />
      ) : (
        <>
          {state.teams.length > 0 && <TeamBars teams={state.teams} />}
          <AnimatedLeaderboard
            rows={state.leaderboard}
            reserve={state.teams.length ? teamBarRows(state.teams.length) * TEAM_BAR_PITCH + TEAM_BARS_GAP : 0}
          />
        </>
      )}
      <AdvanceBar advanceAt={state.advanceAt} pausedAt={state.pausedAt} />
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
