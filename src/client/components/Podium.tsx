import type { PodiumEntry } from '../../shared/types.ts';
import { Avatar } from './Avatar.tsx';
import { Emoji } from './Emoji.tsx';
import { formatPoints } from '../lib/format.ts';

const MEDALS = ['🥇', '🥈', '🥉'];
/** Visual order: 2nd, 1st, 3rd. */
const SLOTS = [1, 0, 2];

interface PodiumProps {
  entries: PodiumEntry[];
  large?: boolean;
  /** Reveal one place at a time: places above this index (0 = 1st) keep their spot but stay hidden. */
  revealFrom?: number;
}

export function Podium({ entries, large = false, revealFrom }: PodiumProps) {
  const staged = revealFrom !== undefined;
  return (
    <div className={`podium${large ? ' podium-large' : ''}${staged ? ' podium-staged' : ''}`}>
      {SLOTS.map((place) => {
        const entry = entries[place];
        if (!entry) return <div key={place} className="podium-slot empty" />;
        const pending = staged && place < revealFrom;
        return (
          <div key={place} className={`podium-slot place-${place + 1}${pending ? ' pending' : ''}`}>
            <Avatar avatar={entry.avatar} color={entry.color} size={large ? 'lg' : 'md'} />
            <strong className="podium-name">{entry.name}</strong>
            <span className="podium-score">{formatPoints(entry.score)}</span>
            <div className="podium-block">
              <Emoji char={MEDALS[place]} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
