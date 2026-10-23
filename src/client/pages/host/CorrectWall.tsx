import { useEffect, useRef, type ReactNode } from 'react';
import type { CorrectEntry } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { playCorrectChime } from '../../lib/sfx.ts';

/** Answers arriving in the same update pop in one after another rather than all at once. */
const STAGGER_MS = 160;

function Chip({ entry, delay }: { entry: CorrectEntry; delay: number }) {
  return (
    <li className={`correct-chip${delay >= 0 ? ' arriving' : ''}`} style={{ animationDelay: `${Math.max(delay, 0)}ms` }}>
      <Avatar avatar={entry.avatar} color={entry.color} size="sm" />
      <span className="correct-chip-name">{entry.name}</span>
      <span className="correct-chip-points">+{entry.points}</span>
    </li>
  );
}

/**
 * Everyone who answered correctly stays on screen for the rest of the question, in two
 * columns either side of `children` (alternating left/right). Each new arrival pops in with a
 * chime; answers already there when this mounts (host reload) appear without replaying.
 * Mount one per question.
 */
export function CorrectWall({ feed, children }: { feed: CorrectEntry[]; children: ReactNode }) {
  // id → pop-in delay in ms, or -1 for entries present at mount.
  const delays = useRef<Map<string, number> | null>(null);
  const pendingChimes = useRef<number[]>([]);
  const chimeCount = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  if (delays.current === null) delays.current = new Map(feed.map((entry) => [entry.id, -1]));
  let batch = 0;
  for (const entry of feed) {
    if (delays.current.has(entry.id)) continue;
    const delay = batch++ * STAGGER_MS;
    delays.current.set(entry.id, delay);
    pendingChimes.current.push(delay);
  }

  useEffect(() => {
    for (const delay of pendingChimes.current.splice(0)) {
      timers.current.push(setTimeout(() => playCorrectChime(chimeCount.current++), delay));
    }
  }, [feed]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const chip = (entry: CorrectEntry) => <Chip key={entry.id} entry={entry} delay={delays.current?.get(entry.id) ?? -1} />;
  return (
    <>
      <ol className="correct-wall left">{feed.filter((_, i) => i % 2 === 0).map(chip)}</ol>
      {children}
      <ol className="correct-wall right">{feed.filter((_, i) => i % 2 === 1).map(chip)}</ol>
    </>
  );
}
