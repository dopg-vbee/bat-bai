import { useState } from 'react';
import { animatedEmojiUrl, EMOJI_NAMES, emojiUrl } from '../../shared/emoji.ts';

/** Fluent Emoji image; falls back to the system glyph for characters not in EMOJI_NAMES. */
export function Emoji({ char, className = '' }: { char: string; className?: string }) {
  if (!EMOJI_NAMES[char]) return <span className={className}>{char}</span>;
  return <img className={`emoji ${className}`} src={emojiUrl(char)} alt={char} draggable={false} />;
}

const EMOJI_PATTERN = /(\p{Extended_Pictographic}️?)/u;

/** A sentence whose emoji are drawn with <Emoji>. */
export function EmojiText({ text }: { text: string }) {
  return (
    <>
      {text.split(EMOJI_PATTERN).map((part, i) => (i % 2 ? <Emoji key={i} char={part} /> : part))}
    </>
  );
}

/** Google Noto animated emoji for the big moments; shows the static Fluent one if it can't load. */
export function AnimatedEmoji({ char, className = '' }: { char: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  function handleError() {
    setFailed(true);
  }

  return (
    <img
      className={`emoji-animated ${className}`}
      src={failed ? emojiUrl(char) : animatedEmojiUrl(char)}
      alt={char}
      draggable={false}
      onError={handleError}
    />
  );
}

/** Warms the browser cache so the animation shows instantly when its moment comes. */
export function preloadAnimatedEmoji(chars: string[]) {
  for (const char of chars) new Image().src = animatedEmojiUrl(char);
}
