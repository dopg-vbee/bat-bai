export interface Luck {
  /** Question indexes worth double points. */
  doubleRounds: number[];
  /** Chance (0–1) that a correct answer also opens a gift box. */
  giftChance: number;
}

const DOUBLE_SHARE = 0.2;
const GIFT_CHANCE = 0.15;
const GIFT_STEPS = [100, 150, 200, 250, 300];

/** About a fifth of the questions (never the first) score double; 15% of correct answers get a gift. */
export function pickLuck(questionCount: number, random = Math.random): Luck {
  const candidates = Array.from({ length: Math.max(0, questionCount - 1) }, (_, i) => i + 1);
  const count = questionCount >= 3 ? Math.max(1, Math.round(questionCount * DOUBLE_SHARE)) : 0;
  const doubleRounds: number[] = [];
  while (doubleRounds.length < count && candidates.length) {
    doubleRounds.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0]);
  }
  return { doubleRounds: doubleRounds.sort((a, b) => a - b), giftChance: GIFT_CHANCE };
}

/** A gift box's bonus for a correct answer, or 0 when none opens. */
export const rollGift = ({ giftChance }: Luck) =>
  Math.random() < giftChance ? GIFT_STEPS[Math.floor(Math.random() * GIFT_STEPS.length)] : 0;

/** 1000 points for an instant answer, sliding down to 500 at the buzzer. */
export function scoreFor(elapsedMs: number, durationMs: number): number {
  const ratio = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  return Math.round(1000 - 500 * ratio);
}
