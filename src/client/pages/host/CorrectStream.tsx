import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { TEAMS, type CorrectEntry } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Emoji } from '../../components/Emoji.tsx';
import { OnFire, StreakTag } from '../../components/Fire.tsx';
import { GiftTag } from '../../components/Luck.tsx';
import { playCorrectChime } from '../../lib/sfx.ts';
import { useSize } from '../../lib/useSize.ts';

// The row of correct answers stays centred: each new one runs in from the right edge, stops
// next to the previous one, and the whole row slides left by half a step to stay centred.
// Once the row is wider than the screen, the newest stays at the right and the oldest leave
// on the left (faded out by a mask on .correct-stream).
/** Item width as a share of the row's height; leaves headroom for the newest avatar's ring. */
const WIDTH_PER_HEIGHT = 0.85;
const MIN_ITEM_WIDTH = 120;
const MAX_ITEM_WIDTH = 380;
const GAP = 14;
/** Room kept at the right edge once the row overflows. */
const EDGE_MARGIN = 24;
/** Answers arriving in the same update pop in one after another. */
const STAGGER_MS = 160;
/** Sizes above are for a ~900px tall screen; the strip scales with the screen height. */
const DESIGN_HEIGHT = 900;
const MIN_UNIT = 0.8;
const MAX_UNIT = 1.35;

/** Left edge of each item (oldest first) so the row is centred, or right-aligned if it overflows. */
function layout(count: number, width: number, containerWidth: number): number[] {
  const step = width + GAP;
  const rowWidth = count * width + Math.max(0, count - 1) * GAP;
  const start = rowWidth <= containerWidth ? (containerWidth - rowWidth) / 2 : containerWidth - EDGE_MARGIN - rowWidth;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

export function useScreenUnit() {
  const fit = () => Math.min(MAX_UNIT, Math.max(MIN_UNIT, window.innerHeight / DESIGN_HEIGHT));
  const [unit, setUnit] = useState(fit);
  useEffect(() => {
    const update = () => setUnit(fit());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return unit;
}

/**
 * Remembers which ids were already there at mount (no pop-in or chime on a host reload) and
 * staggers the ones that arrive together. Returns each id's pop-in delay (-1 = no animation).
 */
export function useArrivals(ids: string[], onArrive?: () => void) {
  const delays = useRef<Map<string, number> | null>(null);
  const pending = useRef<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  if (delays.current === null) delays.current = new Map(ids.map((id) => [id, -1]));
  let batch = 0;
  for (const id of ids) {
    if (delays.current.has(id)) continue;
    const delay = batch++ * STAGGER_MS;
    delays.current.set(id, delay);
    pending.current.push(delay);
  }
  useEffect(() => {
    for (const delay of pending.current.splice(0)) {
      if (onArrive) timers.current.push(setTimeout(onArrive, delay));
    }
  });
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (id: string) => delays.current?.get(id) ?? -1;
}

/** Correct answers of the round in a centred row; newcomers run in from the right. Memoised:
 * the question screen re-renders ten times a second for its clock. */
export const CorrectStream = memo(function CorrectStream({ entries }: { entries: CorrectEntry[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const { width: containerWidth, height } = useSize(listRef);
  const width = Math.min(MAX_ITEM_WIDTH, Math.max(MIN_ITEM_WIDTH, height * WIDTH_PER_HEIGHT));
  const chimes = useRef(0);
  const delayOf = useArrivals(
    entries.map((e) => e.id),
    () => playCorrectChime(chimes.current++),
  );
  const lefts = layout(entries.length, width, containerWidth);

  return (
    <ol ref={listRef} className="correct-stream" style={{ '--item': `${width}px` } as CSSProperties}>
      {containerWidth > 0 &&
        entries.map((entry, i) => {
          // Off the left edge for good: not rendered (100 burning avatars nobody sees add up).
          // One step of slack lets the last one finish sliding out first.
          if (lefts[i] + 2 * (width + GAP) < 0) return null;
          const delay = delayOf(entry.id);
          const style = {
            width,
            transform: `translateX(${lefts[i]}px)`,
            // Where a newcomer starts its run: just past the right edge.
            '--enter-from': `${containerWidth - lefts[i]}px`,
          } as CSSProperties;
          return (
            <li key={entry.id} className={`stream-slot${i === entries.length - 1 ? ' newest' : ''}`} style={style}>
              <div
                className={`stream-correct${delay >= 0 ? ' arriving' : ''}`}
                style={delay >= 0 ? { animationDelay: `${delay}ms` } : undefined}
              >
                <span className="stream-avatar">
                  <OnFire streak={entry.streak}>
                    <Avatar avatar={entry.avatar} color={entry.color} size="lg" />
                  </OnFire>
                  <StreakTag streak={entry.streak} className="stream-streak" />
                  {entry.gift > 0 && (
                    <GiftTag gift={entry.gift} stolenFrom={entry.stolenFrom} className="stream-gift" />
                  )}
                </span>
                <span className="stream-name">
                  {entry.name} {entry.team !== null && <Emoji char={TEAMS[entry.team].emoji} />}
                </span>
                <span className="stream-points">+{entry.points}</span>
              </div>
            </li>
          );
        })}
    </ol>
  );
});
