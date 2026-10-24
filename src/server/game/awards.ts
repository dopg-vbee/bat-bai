import { STREAK_MIN, type GameAwards } from '../../shared/types.ts';
import { identity, longestStreak, type Player } from './player.ts';

/** Fun titles for the final screen over questions 0..lastIndex; each is null when nobody earned it. */
export function computeAwards(players: Player[], titles: string[], lastIndex: number): GameAwards {
  let fastest: GameAwards['fastest'] = null;
  let streak: GameAwards['streak'] = null;
  let guesser: GameAwards['guesser'] = null;
  for (const p of players) {
    for (const [index, { ms }] of p.answers) {
      if (!fastest || ms < fastest.ms) fastest = { ...identity(p), ms, question: titles[index] };
    }
    const best = longestStreak(p);
    if (best >= STREAK_MIN && (!streak || best > streak.streak)) streak = { ...identity(p), streak: best };
    if (p.wrongTotal > 0 && (!guesser || p.wrongTotal > guesser.wrong)) {
      guesser = { ...identity(p), wrong: p.wrongTotal };
    }
  }
  let hardest: GameAwards['hardest'] = null;
  for (let i = 0; i <= lastIndex; i++) {
    const correct = players.filter((p) => p.answers.has(i)).length;
    if (!hardest || correct < hardest.correct) hardest = { title: titles[i], correct, players: players.length };
  }
  return { fastest, streak, guesser, hardest };
}
