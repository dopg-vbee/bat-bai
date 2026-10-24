import type { TeamStanding } from '../../shared/types.ts';

interface TeamMember {
  team: number | null;
  score: number;
}

const membersOf = (members: TeamMember[], team: number) => members.filter((m) => m.team === team);

/** The team with the fewest members (the first such on a tie), for a newcomer. */
export function smallestTeam(members: TeamMember[], teamCount: number): number {
  let best = 0;
  for (let team = 1; team < teamCount; team++) {
    if (membersOf(members, team).length < membersOf(members, best).length) best = team;
  }
  return best;
}

/** Teams ranked by their members' average score (fair whatever their size), best first. */
export function teamStandings(members: TeamMember[], teamCount: number): TeamStanding[] {
  const standings: TeamStanding[] = [];
  for (let team = 0; team < teamCount; team++) {
    const inTeam = membersOf(members, team);
    const total = inTeam.reduce((sum, m) => sum + m.score, 0);
    standings.push({ team, score: inTeam.length ? Math.round(total / inTeam.length) : 0, members: inTeam.length });
  }
  return standings.sort((a, b) => b.score - a.score || a.team - b.team);
}
