import { describe, expect, it } from 'vitest';
import { dealTeams, smallestTeam, teamStandings } from '../src/server/game/teams.ts';

describe('teams', () => {
  it('puts a newcomer in the smallest team, the first one on a tie', () => {
    expect(smallestTeam([], 3)).toBe(0);
    expect(smallestTeam([{ team: 0, score: 0 }], 3)).toBe(1);
    expect(smallestTeam([{ team: 0, score: 0 }, { team: 1, score: 0 }, { team: 2, score: 0 }], 3)).toBe(0);
  });

  it('deals everyone, chosen or not, into teams as even as possible', () => {
    const members = Array.from({ length: 10 }, (_, i) => ({ team: i < 4 ? 0 : null, score: 0 }));
    dealTeams(members, 4);
    const sizes = [0, 1, 2, 3].map((team) => members.filter((m) => m.team === team).length);
    expect(sizes.sort()).toEqual([2, 2, 3, 3]);
  });

  it('ranks teams on their average score, so a bigger team has no edge', () => {
    const members = [
      { team: 0, score: 1000 },
      { team: 0, score: 1000 },
      { team: 0, score: 100 },
      { team: 1, score: 900 },
    ];
    expect(teamStandings(members, 3)).toEqual([
      { team: 1, score: 900, members: 1 },
      { team: 0, score: 700, members: 3 },
      { team: 2, score: 0, members: 0 },
    ]);
  });
});
