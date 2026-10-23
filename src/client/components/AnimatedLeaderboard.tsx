import { useEffect, useState } from 'react';
import type { RankRow } from '../../shared/types.ts';
import { Avatar } from './Avatar.tsx';
import { Delta } from './Leaderboard.tsx';

const SETTLE_DELAY_MS = 500;
/** Must match the .lb-row transform transition. */
const MOVE_MS = 1200;
/** Rank numbers switch halfway through the slide. */
const RENUMBER_DELAY_MS = MOVE_MS / 2;
const COUNT_UP_MS = 1200;
const ROW_GAP = 8;
const MAX_PITCH = 64;
const MIN_PITCH = 40;
/** Header, title, progress bar and button around the list on the host screen. */
const RESERVED_HEIGHT = 250;

/** Row height plus gap, shrunk so the whole list fits the screen height. Rows are absolutely positioned. */
function useRowPitch(count: number) {
  const fit = () =>
    Math.max(MIN_PITCH, Math.min(MAX_PITCH, Math.floor((window.innerHeight - RESERVED_HEIGHT) / Math.max(count, 1))));
  const [pitch, setPitch] = useState(fit);
  useEffect(() => {
    const update = () => setPitch(fit());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [count]);
  return pitch;
}

/** Animates a number from `from` to `to` once `run` turns true. */
export function CountUp({ from, to, run }: { from: number; to: number; run: boolean }) {
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (!run || from === to) {
      setValue(run ? to : from);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      setValue(Math.round(from + (to - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, from, to]);

  return <>{value.toLocaleString('vi-VN')}</>;
}

/**
 * Starts from the previous round's order and scores, then slides every row to its new rank
 * while the scores count up. Players climbing in from outside the top list fade in from below.
 */
export function AnimatedLeaderboard({ rows }: { rows: RankRow[] }) {
  const [settled, setSettled] = useState(false);
  const [renumbered, setRenumbered] = useState(false);
  const [moved, setMoved] = useState(false);
  const pitch = useRowPitch(rows.length);

  useEffect(() => {
    const timers = [
      setTimeout(() => setSettled(true), SETTLE_DELAY_MS),
      setTimeout(() => setRenumbered(true), SETTLE_DELAY_MS + RENUMBER_DELAY_MS),
      setTimeout(() => setMoved(true), SETTLE_DELAY_MS + MOVE_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <ol className="lb-anim" style={{ height: rows.length * pitch }}>
      {rows.map((row) => {
        const prevRank = row.rank + row.delta;
        const fromOutside = prevRank > rows.length;
        const slot = (settled ? row.rank : Math.min(prevRank, rows.length + 1)) - 1;
        // While sliding, climbers lift above the others and fallers sink behind them.
        const motion = settled && !moved && row.delta !== 0 ? (row.delta > 0 ? 'moving-up' : 'moving-down') : '';
        const scale = motion === 'moving-up' ? 1.05 : motion === 'moving-down' ? 0.96 : 1;
        return (
          <li
            key={row.id}
            className={`leaderboard-row lb-row ${motion}${settled && row.delta > 0 ? ' climbed' : ''}`}
            style={{
              height: pitch - ROW_GAP,
              transform: `translateY(${slot * pitch}px) scale(${scale})`,
              opacity: !settled && fromOutside ? 0 : 1,
            }}
          >
            <span className="leaderboard-rank">{renumbered ? row.rank : prevRank}</span>
            <Avatar avatar={row.avatar} color={row.color} size="sm" />
            <span className="leaderboard-name">{row.name}</span>
            {row.roundPoints > 0 && <span className={`leaderboard-gain${settled ? ' show' : ''}`}>+{row.roundPoints}</span>}
            {renumbered && <Delta value={row.delta} />}
            <span className="leaderboard-score">
              <CountUp from={row.score - row.roundPoints} to={row.score} run={settled} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
