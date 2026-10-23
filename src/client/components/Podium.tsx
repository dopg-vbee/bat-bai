import type { PodiumEntry } from '../../shared/types.ts';
import { Avatar } from './Avatar.tsx';
import { Emoji } from './Emoji.tsx';

const MEDALS = ['🥇', '🥈', '🥉'];
/** Visual order: 2nd, 1st, 3rd. */
const SLOTS = [1, 0, 2];

export function Podium({ entries, large = false }: { entries: PodiumEntry[]; large?: boolean }) {
  return (
    <div className={`podium${large ? ' podium-large' : ''}`}>
      {SLOTS.map((place) => {
        const entry = entries[place];
        if (!entry) return <div key={place} className="podium-slot empty" />;
        return (
          <div key={place} className={`podium-slot place-${place + 1}`}>
            <Avatar avatar={entry.avatar} color={entry.color} size={large ? 'lg' : 'md'} />
            <strong className="podium-name">{entry.name}</strong>
            <span className="podium-score">{entry.score.toLocaleString('vi-VN')}</span>
            <div className="podium-block">
              <Emoji char={MEDALS[place]} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
