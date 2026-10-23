import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CorrectEntry } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { playCorrectChime } from '../../lib/sfx.ts';

// The newest correct answer sits in the middle of the screen; each new one pushes the older
// ones to the left, shrinking and fading them. Items past the left edge are clipped.
const ITEM_WIDTH = 150;
const GAP = 14;
const SHRINK = 0.88;
const MIN_SCALE = 0.55;
const FADE_PER_STEP = 0.07;
const MIN_OPACITY = 0.3;
/** Answers arriving in the same update pop in one after another. */
const STAGGER_MS = 160;
/** Sizes above are for a ~900px tall screen; the strip scales with the screen height. */
const DESIGN_HEIGHT = 900;
const MIN_UNIT = 0.8;
const MAX_UNIT = 1.35;

interface Slot {
  offset: number;
  scale: number;
  opacity: number;
}

/** Slot k = k-th newest: centres are spaced by the (scaled) item width plus a gap. */
function layout(count: number, width: number): Slot[] {
  const slots: Slot[] = [];
  let offset = 0;
  for (let k = 0; k < count; k++) {
    const scale = Math.max(MIN_SCALE, SHRINK ** k);
    if (k > 0) offset += (width * (slots[k - 1].scale + scale)) / 2 + GAP * scale;
    slots.push({ offset, scale, opacity: Math.max(MIN_OPACITY, 1 - k * FADE_PER_STEP) });
  }
  return slots;
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

/** Correct answers of the round, newest in the middle of the screen, older ones pushed left. */
export function CorrectStream({ entries }: { entries: CorrectEntry[] }) {
  const unit = useScreenUnit();
  const width = ITEM_WIDTH * unit;
  const chimes = useRef(0);
  const delayOf = useArrivals(
    entries.map((e) => e.id),
    () => playCorrectChime(chimes.current++),
  );
  const newestFirst = [...entries].reverse();
  const slots = layout(newestFirst.length, width);

  return (
    <ol className="correct-stream" style={{ '--u': unit } as CSSProperties}>
      {newestFirst.map((entry, k) => {
        const { offset, scale, opacity } = slots[k];
        const delay = delayOf(entry.id);
        return (
          <li
            key={entry.id}
            className={`stream-slot${k === 0 ? ' newest' : ''}`}
            style={{ width, left: `calc(50% - ${width / 2}px)`, transform: `translateX(${-offset}px) scale(${scale})`, opacity }}
          >
            <div
              className={`stream-correct${delay >= 0 ? ' arriving' : ''}`}
              style={delay >= 0 ? { animationDelay: `${delay}ms` } : undefined}
            >
              <Avatar avatar={entry.avatar} color={entry.color} size="lg" />
              <span className="stream-name">{entry.name}</span>
              <span className="stream-points">+{entry.points}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
