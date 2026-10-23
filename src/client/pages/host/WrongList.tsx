import { X } from 'lucide-react';
import { memo, type CSSProperties } from 'react';
import type { WrongEntry } from '../../../shared/types.ts';
import { useArrivals, useScreenUnit } from './CorrectStream.tsx';

const VISIBLE = 10;
const FADE_PER_STEP = 0.08;

/** The latest wrong guesses (text only, anonymous) down the left edge, newest on top, fading out. */
export const WrongList = memo(function WrongList({ entries }: { entries: WrongEntry[] }) {
  const unit = useScreenUnit();
  const delayOf = useArrivals(entries.map((e) => e.key));
  const latest = entries.slice(-VISIBLE).reverse();

  return (
    <aside className="wrong-list" style={{ '--u': unit } as CSSProperties} aria-label="Câu trả lời sai gần đây">
      {latest.length > 0 && (
        <p className="wrong-list-title">
          <X /> Câu trả lời sai
        </p>
      )}
      <ol>
        {latest.map((entry, i) => (
          <li
            key={entry.key}
            className={`wrong-item${delayOf(entry.key) >= 0 ? ' arriving' : ''}`}
            style={{ opacity: 1 - i * FADE_PER_STEP }}
          >
            {entry.text}
          </li>
        ))}
      </ol>
    </aside>
  );
});
