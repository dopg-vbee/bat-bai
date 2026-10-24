import type { CSSProperties } from 'react';
import { TEAMS, type PodiumEntry, type TeamStanding } from '../../shared/types.ts';
import { Emoji } from './Emoji.tsx';

const teamStyle = (team: number, extra: Record<string, number> = {}) =>
  ({ '--team': TEAMS[team].color, ...extra }) as CSSProperties;

/** "❤️ Đội Đỏ" in the team's colour. */
export function TeamBadge({ team, className = '' }: { team: number; className?: string }) {
  return (
    <span className={`team-badge ${className}`} style={teamStyle(team)}>
      <Emoji char={TEAMS[team].emoji} /> Đội {TEAMS[team].name}
    </span>
  );
}

/** Teams as bars sized by their score (members' average), best first. */
export function TeamBars({ teams, large = false }: { teams: TeamStanding[]; large?: boolean }) {
  const top = Math.max(1, ...teams.map((t) => t.score));
  return (
    <ol className={`team-bars${large ? ' team-bars-large' : ''}`}>
      {teams.map(({ team, score, members }, i) => (
        <li key={team} className="team-bar" style={teamStyle(team, { '--share': score / top })}>
          <span className="team-bar-rank">{i + 1}</span>
          <span className="team-bar-name">
            <Emoji char={TEAMS[team].emoji} /> Đội {TEAMS[team].name}
            <small>{members} người</small>
          </span>
          <span className="team-bar-track">
            <span className="team-bar-fill" />
          </span>
          <span className="team-bar-score">{score.toLocaleString('vi-VN')}</span>
        </li>
      ))}
    </ol>
  );
}

/** The top three teams, shaped like a players' podium (the server builds the same for phones). */
export const teamPodium = (teams: TeamStanding[]): PodiumEntry[] =>
  teams.slice(0, 3).map(({ team, score }) => ({
    name: `Đội ${TEAMS[team].name}`,
    avatar: TEAMS[team].emoji,
    color: TEAMS[team].color,
    score,
  }));
