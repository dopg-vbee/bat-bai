export interface Player {
  id: string;
  token: string;
  name: string;
  avatar: string;
  color: string;
  score: number;
  /** Sum of answer times, breaks ties in the ranking. */
  totalMs: number;
  joinedAt: number;
  prevRank: number;
  lastGuessAt: number;
  socketId: string | null;
  bot: boolean;
  /** Index into TEAMS, or null outside team play. */
  team: number | null;
  /** Wrong guesses over the whole game, for the "most wrong guesses" award. */
  wrongTotal: number;
  /**
   * By question index. points = speed score (doubled on lucky rounds) + gift + streak bonus;
   * byTeam: credited because a teammate got it right ("together" team mode);
   * stolenFrom: the gift was taken from this player (the leader).
   */
  answers: Map<number, { points: number; gift: number; ms: number; byTeam?: boolean; stolenFrom?: Player }>;
  /** Points stolen from this player, by question index. */
  robbed: Map<number, number>;
}

export const isOnline = (p: Player) => p.bot || p.socketId !== null;
export const identity = (p: Player) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color });

/** Correct answers in a row ending at question `index` (0 if that one was missed). */
export function streakAt(p: Player, index: number): number {
  let streak = 0;
  while (p.answers.has(index - streak)) streak++;
  return streak;
}

/** Longest run of correct answers over the game. */
export function longestStreak(p: Player): number {
  let best = 0;
  for (const index of p.answers.keys()) {
    if (p.answers.has(index - 1)) continue; // only count from the start of each run
    let run = 1;
    while (p.answers.has(index + run)) run++;
    best = Math.max(best, run);
  }
  return best;
}
