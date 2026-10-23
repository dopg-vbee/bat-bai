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

/** "🎁 +200" bonus from a gift box. */
export function GiftTag({ gift, className = '' }: { gift: number; className?: string }) {
  return (
    <span className={`gift-tag ${className}`}>
      <Emoji char="🎁" /> +{gift}
    </span>
  );
}
