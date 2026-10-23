import type { CSSProperties, ReactNode } from 'react';
import { animatedEmojiUrl } from '../../shared/emoji.ts';
import { STREAK_MAX, STREAK_MIN, streakBonus } from '../../shared/types.ts';
import { Emoji } from './Emoji.tsx';

export const isOnFire = (streak: number) => streak >= STREAK_MIN;

const FIRE_STEPS = 4;

/** 0, ⅓, ⅔ or 1: four sizes of flames from STREAK_MIN to STREAK_MAX in a row (3 · 4–5 · 6–7 · 8+). */
const fireLevel = (streak: number) => {
  const progress = (Math.min(streak, STREAK_MAX) - STREAK_MIN) / (STREAK_MAX - STREAK_MIN);
  return Math.round(progress * (FIRE_STEPS - 1)) / (FIRE_STEPS - 1);
};

const EMBERS = 5;

/**
 * The avatar (or whatever it wraps) burning while a correct-answer streak lasts: Noto's animated
 * flame behind it, embers rising and a glow, all growing with the streak.
 */
export function OnFire({ streak, children }: { streak: number; children: ReactNode }) {
  if (!isOnFire(streak)) return children;
  return (
    <span className="on-fire" style={{ '--fire': fireLevel(streak) } as CSSProperties}>
      {/* Keyed by the streak so the flames flare up again each time it grows. */}
      <span key={streak} className="flames" aria-hidden>
        <img src={animatedEmojiUrl('🔥')} alt="" draggable={false} />
        {Array.from({ length: EMBERS }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      {children}
    </span>
  );
}

interface StreakTagProps {
  streak: number;
  /** Spell it out with the bonus: "Chuỗi 4 câu đúng · +100". */
  long?: boolean;
  className?: string;
}

/** "🔥 4" on a streak; nothing below STREAK_MIN. */
export function StreakTag({ streak, long = false, className = '' }: StreakTagProps) {
  if (!isOnFire(streak)) return null;
  return (
    <span className={`streak-tag ${className}`} title={`${streak} câu đúng liên tiếp`}>
      <Emoji char="🔥" /> {long ? `Chuỗi ${streak} câu đúng · +${streakBonus(streak)}` : streak}
    </span>
  );
}
