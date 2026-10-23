import type { RankRow } from '../../shared/types.ts';
import { Avatar } from './Avatar.tsx';

function Delta({ value }: { value: number }) {
  if (value > 0) return <span className="delta up">▲{value}</span>;
  if (value < 0) return <span className="delta down">▼{-value}</span>;
  return <span className="delta">–</span>;
}

export function Leaderboard({ rows, showRoundPoints = true }: { rows: RankRow[]; showRoundPoints?: boolean }) {
  return (
    <ol className="leaderboard">
      {rows.map((row, i) => (
        <li key={row.id} className="leaderboard-row" style={{ animationDelay: `${i * 0.06}s` }}>
          <span className="leaderboard-rank">{row.rank}</span>
          <Avatar avatar={row.avatar} color={row.color} size="sm" />
          <span className="leaderboard-name">{row.name}</span>
          {showRoundPoints && row.roundPoints > 0 && <span className="leaderboard-gain">+{row.roundPoints}</span>}
          <Delta value={row.delta} />
          <span className="leaderboard-score">{row.score.toLocaleString('vi-VN')}</span>
        </li>
      ))}
    </ol>
  );
}
