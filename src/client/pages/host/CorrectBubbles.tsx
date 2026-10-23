import { useEffect, useRef, useState } from 'react';
import type { CorrectEntry } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { playCorrectChime } from '../../lib/sfx.ts';

interface Bubble {
  entry: CorrectEntry;
  /** Horizontal position in %, so simultaneous bubbles spread out. */
  x: number;
}

const BUBBLE_LIFE_MS = 2600;
/** Answers arriving in the same update pop one after another rather than all at once. */
const STAGGER_MS = 160;

/**
 * Every new correct answer pops a bubble (avatar, name, points) that floats up the big screen,
 * with a chime. Mount one per question; answers already in the feed at mount are not replayed.
 */
export function CorrectBubbles({ feed }: { feed: CorrectEntry[] }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const seen = useRef(new Set(feed.map((entry) => entry.id)));
  const chimes = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const fresh = feed.filter((entry) => !seen.current.has(entry.id));
    fresh.forEach((entry, i) => {
      seen.current.add(entry.id);
      timers.current.push(
        setTimeout(() => {
          playCorrectChime(chimes.current++);
          setBubbles((list) => [...list, { entry, x: 8 + Math.random() * 84 }]);
          timers.current.push(
            setTimeout(() => setBubbles((list) => list.filter((b) => b.entry.id !== entry.id)), BUBBLE_LIFE_MS),
          );
        }, i * STAGGER_MS),
      );
    });
  }, [feed]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className="bubbles" aria-live="polite">
      {bubbles.map(({ entry, x }) => (
        <div key={entry.id} className="bubble" style={{ left: `${x}%` }}>
          <Avatar avatar={entry.avatar} color={entry.color} size="lg" />
          <span className="bubble-name">{entry.name}</span>
          <span className="bubble-points">+{entry.points}</span>
        </div>
      ))}
    </div>
  );
}
