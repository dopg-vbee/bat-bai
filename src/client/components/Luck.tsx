import { Emoji } from './Emoji.tsx';

/** Splash shown during the countdown of a lucky (double points) question. */
export function LuckyBanner({ large = false }: { large?: boolean }) {
  return (
    <div className={`lucky-banner${large ? ' large' : ''}`} role="status">
      <Emoji char="⚡" className="lucky-bolt" />
      <span className="lucky-title">Câu may mắn</span>
      <span className="lucky-x2">x2 điểm</span>
    </div>
  );
}

/** Small "⚡ x2" tag for the rest of a lucky question. */
export function DoubleTag() {
  return (
    <span className="double-tag">
      <Emoji char="⚡" /> x2 điểm
    </span>
  );
}

interface GiftTagProps {
  gift: number;
  /** The box stole the points from this player (the leader). */
  stolenFrom?: string | null;
  /** Name the player robbed, not just the ninja. */
  long?: boolean;
  className?: string;
}

/** "🎁 +200" bonus from a gift box, or "🥷 +150" when it stole them from the leader. */
export function GiftTag({ gift, stolenFrom = null, long = false, className = '' }: GiftTagProps) {
  return (
    <span className={`gift-tag ${className}`}>
      <Emoji char={stolenFrom ? '🥷' : '🎁'} /> +{gift}
      {stolenFrom && long && ` của ${stolenFrom}`}
    </span>
  );
}
