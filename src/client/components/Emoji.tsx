import { useEffect, useState } from 'react';
import { animatedEmojiUrl, EMOJI_NAMES, emojiUrl } from '../../shared/emoji.ts';
import { playOnceBlob } from '../lib/playOnce.ts';

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

interface AnimatedEmojiProps {
  char: string;
  className?: string;
  /** Play the animation a single time and stop on its last frame (otherwise it loops). */
  once?: boolean;
}

/** Google Noto animated emoji for the big moments; shows the static Fluent one if it can't load. */
export function AnimatedEmoji({ char, className = '', once = false }: AnimatedEmojiProps) {
  const [failed, setFailed] = useState(false);
  const [onceSrc, setOnceSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!once) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    playOnceBlob(animatedEmojiUrl(char))
      .then((blob) => {
        if (cancelled) return;
        // A fresh URL per mount: images sharing a URL share their animation, so a second
        // mount would show the last frame instead of playing.
        objectUrl = URL.createObjectURL(blob);
        setOnceSrc(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [char, once]);

  function handleError() {
    setFailed(true);
  }

  const src = failed ? emojiUrl(char) : once ? onceSrc : animatedEmojiUrl(char);
  if (!src) return <span className={`emoji-animated ${className}`} aria-hidden />;
  return <img className={`emoji-animated ${className}`} src={src} alt={char} draggable={false} onError={handleError} />;
}

/** Fetches the animations ahead of time so they show instantly when their moment comes. */
export function preloadAnimatedEmoji(chars: string[], { once = false } = {}) {
  for (const char of chars) {
    if (once) playOnceBlob(animatedEmojiUrl(char)).catch(() => undefined);
    else new Image().src = animatedEmojiUrl(char);
  }
}
