import type { CSSProperties } from 'react';
import { TEAMS, type PodiumEntry, type RankRow, type TeamStanding } from '../../shared/types.ts';
import { Emoji } from './Emoji.tsx';
import { formatPoints } from '../lib/format.ts';

const teamStyle = (team: number, extra: Record<string, number> = {}) =>
  ({ '--team': TEAMS[team].color, ...extra }) as CSSProperties;

interface TeamBadgeProps {
  team: number;
  /** Just the colour name ("Đỏ"), where "Đội" goes without saying and room is short. */
  short?: boolean;
  className?: string;
}

/** "❤️ Đội Đỏ" in the team's colour. */
export function TeamBadge({ team, short = false, className = '' }: TeamBadgeProps) {
  return (
    <span className={`team-badge ${className}`} style={teamStyle(team)}>
      <Emoji char={TEAMS[team].emoji} />
      <span className="team-badge-name">{short ? TEAMS[team].name : `Đội ${TEAMS[team].name}`}</span>
    </span>
  );
}

/** Up to 5 teams take a row each; more are laid out in two columns. */
const barColumns = (teams: number) => (teams > 5 ? 2 : 1);

/** Teams as bars sized by their score (members' average), best first, reading down each column. */
export function TeamBars({ teams }: { teams: TeamStanding[] }) {
  const top = Math.max(1, ...teams.map((t) => t.score));
  return (
    <ol
      className="team-bars"
      style={{ '--rows': Math.ceil(teams.length / barColumns(teams.length)) } as CSSProperties}
    >
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
          <span className="team-bar-score">{formatPoints(score)}</span>
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

/** Teams as rows of the regular leaderboard: the heart in place of an avatar, the same movement and points. */
export const teamRows = (teams: TeamStanding[]): RankRow[] =>
  teams.map(({ team, score, delta, roundPoints }, i) => ({
    id: `team-${team}`,
    name: `Đội ${TEAMS[team].name}`,
    avatar: TEAMS[team].emoji,
    color: TEAMS[team].color,
    score,
    rank: i + 1,
    delta,
    roundPoints,
    streak: 0,
    team: null,
  }));
