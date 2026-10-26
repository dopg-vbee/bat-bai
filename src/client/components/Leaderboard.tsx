import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { RankRow } from '../../shared/types.ts';
import { Avatar } from './Avatar.tsx';
import { formatPoints } from '../lib/format.ts';

export function Delta({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="delta up">
        <ArrowUp strokeWidth={3} />
        {value}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="delta down">
        <ArrowDown strokeWidth={3} />
        {-value}
      </span>
    );
  }
  return (
    <span className="delta">
      <Minus strokeWidth={3} />
    </span>
  );
}

/** Everyone below the podium on the final screen, sliding in one after another. */
export function Leaderboard({ rows }: { rows: RankRow[] }) {
  return (
    <ol className="leaderboard">
      {rows.map((row, i) => (
        <li key={row.id} className="leaderboard-row" style={{ animationDelay: `${Math.min(i * 0.04, 1.2)}s` }}>
          <span className="leaderboard-rank">{row.rank}</span>
          <Avatar avatar={row.avatar} color={row.color} size="sm" />
          <span className="leaderboard-name">{row.name}</span>
          <span className="leaderboard-score">{formatPoints(row.score)}</span>
        </li>
      ))}
    </ol>
  );
}
