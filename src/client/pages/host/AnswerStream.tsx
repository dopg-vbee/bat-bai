import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CorrectEntry, WrongEntry } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { playCorrectChime } from '../../lib/sfx.ts';

// Each lane is a row anchored at the centre line: the newest item sits next to it and every
// new one pushes the older ones outwards (correct → left, wrong → right), shrinking and fading
// them; items past the screen edge are clipped by the lane.
const CORRECT_WIDTH = 150;
const WRONG_WIDTH = 230;
const GAP = 14;
const SHRINK = 0.88;
const MIN_SCALE = 0.55;
const FADE_PER_STEP = 0.07;
const MIN_OPACITY = 0.3;
/** Answers arriving in the same update pop in one after another. */
const STAGGER_MS = 160;
/** The whole strip scales with the screen height (sizes above are for a ~900px tall screen). */
const DESIGN_HEIGHT = 900;
const MIN_UNIT = 0.8;
const MAX_UNIT = 1.35;

function useUnit() {
  const fit = () => Math.min(MAX_UNIT, Math.max(MIN_UNIT, window.innerHeight / DESIGN_HEIGHT));
  const [unit, setUnit] = useState(fit);
  useEffect(() => {
    const update = () => setUnit(fit());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return unit;
}

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

/** Remembers which ids were already there at mount (no pop-in on a host reload) and staggers new ones. */
function useArrivals(ids: string[], onArrive?: (delay: number) => void) {
  const delays = useRef<Map<string, number> | null>(null);
  const pending = useRef<number[]>([]);
  if (delays.current === null) delays.current = new Map(ids.map((id) => [id, -1]));
  let batch = 0;
  for (const id of ids) {
    if (delays.current.has(id)) continue;
    const delay = batch++ * STAGGER_MS;
    delays.current.set(id, delay);
    pending.current.push(delay);
  }
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    for (const delay of pending.current.splice(0)) {
      if (onArrive) timers.current.push(setTimeout(() => onArrive(delay), delay));
    }
  });
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (id: string) => delays.current?.get(id) ?? -1;
}

const arrivalStyle = (delay: number) => (delay >= 0 ? { animationDelay: `${delay}ms` } : undefined);

/** The live answer strip under the question: correct answers to the left, wrong guesses to the right. */
export function AnswerStream({ correct, wrong }: { correct: CorrectEntry[]; wrong: WrongEntry[] }) {
  const unit = useUnit();
  const correctWidth = CORRECT_WIDTH * unit;
  const wrongWidth = WRONG_WIDTH * unit;
  const chimes = useRef(0);
  const correctDelay = useArrivals(
    correct.map((e) => e.id),
    () => playCorrectChime(chimes.current++),
  );
  const wrongDelay = useArrivals(wrong.map((e) => e.key));

  const newestCorrect = [...correct].reverse();
  const newestWrong = [...wrong].reverse();
  const correctSlots = layout(newestCorrect.length, correctWidth);
  const wrongSlots = layout(newestWrong.length, wrongWidth);

  return (
    <div className="answer-stream" style={{ '--u': unit } as CSSProperties}>
      <ol className="stream-lane correct">
        {newestCorrect.map((entry, k) => {
          const { offset, scale, opacity } = correctSlots[k];
          const delay = correctDelay(entry.id);
          return (
            <li
              key={entry.id}
              className={`stream-slot${k === 0 ? ' newest' : ''}`}
              style={{ width: correctWidth, transform: `translateX(${-offset}px) scale(${scale})`, opacity }}
            >
              <div className={`stream-correct${delay >= 0 ? ' arriving' : ''}`} style={arrivalStyle(delay)}>
                <Avatar avatar={entry.avatar} color={entry.color} size="lg" />
                <span className="stream-name">{entry.name}</span>
                <span className="stream-points">+{entry.points}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="stream-divider" aria-hidden>
        <span className="stream-label correct">
          <Check /> Đúng
        </span>
        <span className="stream-label wrong">
          Sai <X />
        </span>
      </div>
      <ol className="stream-lane wrong">
        {newestWrong.map((entry, k) => {
          const { offset, scale, opacity } = wrongSlots[k];
          const delay = wrongDelay(entry.key);
          return (
            <li
              key={entry.key}
              className="stream-slot"
              style={{ width: wrongWidth, transform: `translateX(${offset}px) scale(${scale})`, opacity }}
            >
              <div className={`stream-wrong${delay >= 0 ? ' arriving' : ''}`} style={arrivalStyle(delay)}>
                <p className="wrong-text">{entry.text}</p>
                <span className="wrong-who">
                  <Avatar avatar={entry.avatar} color={entry.color} size="sm" />
                  {entry.name}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
