export interface Luck {
  /** Question indexes worth double points. */
  doubleRounds: number[];
  /** Chance (0–1) that a correct answer also opens a gift box, by third of the standings (top first). */
  giftChances: number[];
  /** Share (0–1) of opened gift boxes that steal from the leader instead (solo play only). */
  stealShare: number;
}

const DOUBLE_SHARE = 0.15;
/** Players further behind open gifts more often, so the leaders run away less. */
const GIFT_CHANCES = [0.12, 0.14, 0.16];
const GIFT_STEPS = [50, 75, 100, 125, 150];
const STEAL_SHARE = 0.2;
const STEAL_STEPS = [50, 75, 100];

/** About 15% of the questions (never the first, nor the last: that one is x3) score double; 12–16% of correct answers get a gift. */
export function pickLuck(questionCount: number, random = Math.random): Luck {
  const candidates = Array.from({ length: Math.max(0, questionCount - 2) }, (_, i) => i + 1);
  const count = questionCount >= 3 ? Math.max(1, Math.round(questionCount * DOUBLE_SHARE)) : 0;
  const doubleRounds: number[] = [];
  while (doubleRounds.length < count && candidates.length) {
    doubleRounds.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0]);
  }
  return { doubleRounds: doubleRounds.sort((a, b) => a - b), giftChances: GIFT_CHANCES, stealShare: STEAL_SHARE };
}

/** A gift box's bonus for a correct answer by a player in third `tier` (0 = top), or 0 when none opens. */
export const rollGift = ({ giftChances }: Luck, tier: number) =>
  Math.random() < giftChances[tier] ? GIFT_STEPS[Math.floor(Math.random() * GIFT_STEPS.length)] : 0;

/** Points an opened gift box steals from the leader instead, or 0 when it is a plain gift. */
export const rollSteal = ({ stealShare }: Luck) =>
  Math.random() < stealShare ? STEAL_STEPS[Math.floor(Math.random() * STEAL_STEPS.length)] : 0;

/** 1000 points for an instant answer, sliding down to 500 at the buzzer. */
export function scoreFor(elapsedMs: number, durationMs: number): number {
  const ratio = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  return Math.round(1000 - 500 * ratio);
}
