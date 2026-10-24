import { useEffect, useState, type AnimationEvent, type CSSProperties } from 'react';
import { Emoji } from '../../components/Emoji.tsx';
import { socket } from '../../lib/socket.ts';

/** Older ones are dropped beyond this, so a burst from 60 phones stays readable and cheap. */
const MAX_ON_SCREEN = 40;
/** A batch arrives at once; spreading it out makes it look thrown, not stamped. */
const STAGGER_MS = 70;

interface Flying {
  id: number;
  emoji: string;
  /** 0–1 across the column, and a sideways sway for the rise. */
  x: number;
  drift: number;
  delayMs: number;
}

let nextId = 0;

/** Reactions thrown from phones, floating up the right edge of the big screen (clear of the video). */
export function ReactionLayer({ code }: { code: string }) {
  const [flying, setFlying] = useState<Flying[]>([]);

  useEffect(() => {
    const onBatch = (batch: { code: string; emojis: string[] }) => {
      if (batch.code !== code) return;
      const added = batch.emojis.map((emoji, i) => ({
        id: nextId++,
        emoji,
        x: Math.random(),
        drift: Math.random() * 2 - 1,
        delayMs: i * STAGGER_MS,
      }));
      setFlying((list) => [...list, ...added].slice(-MAX_ON_SCREEN));
    };
    socket.on('reactions', onBatch);
    return () => {
      socket.off('reactions', onBatch);
    };
  }, [code]);

  function handleLanded(event: AnimationEvent<HTMLSpanElement>) {
    const id = Number(event.currentTarget.dataset.id);
    setFlying((list) => list.filter((f) => f.id !== id));
  }

  return (
    <div className="reaction-layer" aria-hidden>
      {flying.map((f) => (
        <span
          key={f.id}
          data-id={f.id}
          className="reaction-fly"
          style={{ '--x': f.x, '--drift': f.drift, animationDelay: `${f.delayMs}ms` } as CSSProperties}
          onAnimationEnd={handleLanded}
        >
          <Emoji char={f.emoji} />
        </span>
      ))}
    </div>
  );
}
