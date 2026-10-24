import { useState } from 'react';
import { Emoji, EmojiText } from './Emoji.tsx';

/** What a question worth more points is called: x2 at random, x3 for the final one. */
const MULTIPLIED: Record<number, { emoji: string; title: string }> = {
  2: { emoji: '⚡', title: 'Câu may mắn' },
  3: { emoji: '🏆', title: 'Câu chung kết' },
};

/** Splash shown during the countdown of a lucky (x2) or final (x3) question. */
export function LuckyBanner({ multiplier, large = false }: { multiplier: number; large?: boolean }) {
  const { emoji, title } = MULTIPLIED[multiplier];
  return (
    <div className={`lucky-banner${large ? ' large' : ''}`} role="status">
      <Emoji char={emoji} className="lucky-bolt" />
      <span className="lucky-title">{title}</span>
      <span className="lucky-x2">x{multiplier} điểm</span>
    </div>
  );
}

/** Small "⚡ x2" / "🏆 x3" tag for the rest of the question. */
export function MultiplierTag({ multiplier }: { multiplier: number }) {
  return (
    <span className="double-tag">
      <Emoji char={MULTIPLIED[multiplier].emoji} /> x{multiplier} điểm
    </span>
  );
}

interface GiftTagProps {
  gift: number;
  /** The box "borrowed" the points from this player (the leader). */
  stolenFrom?: string | null;
  /** Name who they came from, not just the icon. */
  long?: boolean;
  className?: string;
}

/** "🎁 +200" bonus from a gift box, or "💸 +150" when it borrowed them from the leader. */
export function GiftTag({ gift, stolenFrom = null, long = false, className = '' }: GiftTagProps) {
  return (
    <span className={`gift-tag ${className}`}>
      <Emoji char={stolenFrom ? '💸' : '🎁'} /> +{gift}
      {stolenFrom && long && ` của ${stolenFrom}`}
    </span>
  );
}

// Light-hearted lines for a gift box that moved points from the leader.
const TAKER_QUIPS = ['Mượn tạm, không hẹn ngày trả 😉', 'Lộc của top 1, xin nhận ạ 😄', 'Của đi thay người 😄'];
const LEADER_QUIPS = [
  'Cái giá phải trả của kẻ đứng đầu 😅',
  'Cây cao thì đón gió lớn 😅',
  'Đứng đầu thì phải biết chia sẻ chứ 😉',
];

/** A random joke for the one who borrowed the points, or (`leader`) the one they came from. */
export function BorrowQuip({ leader = false }: { leader?: boolean }) {
  const quips = leader ? LEADER_QUIPS : TAKER_QUIPS;
  // Picked once per screen, so it doesn't change on every state update.
  const [index] = useState(() => Math.floor(Math.random() * quips.length));
  return (
    <p className="muted-light">
      <EmojiText text={quips[index]} />
    </p>
  );
}
