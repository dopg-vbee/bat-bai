import { useState, type MouseEvent } from 'react';
import { REACTION_COOLDOWN_MS, REACTIONS } from '../../../shared/types.ts';
import { Emoji } from '../../components/Emoji.tsx';
import { socket } from '../../lib/socket.ts';

const POP: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }];

/**
 * Emoji to throw at the big screen once the player is done with the question: one a second (the server
 * drops any more), so the bar rests in between instead of swallowing taps.
 */
export function ReactionBar() {
  const [cooling, setCooling] = useState(false);

  function handleReact(event: MouseEvent<HTMLButtonElement>) {
    if (cooling) return;
    const button = event.currentTarget;
    socket.emit('player:react', button.dataset.emoji ?? '');
    button.animate(POP, { duration: 250 });
    navigator.vibrate?.(15);
    setCooling(true);
    setTimeout(() => setCooling(false), REACTION_COOLDOWN_MS);
  }

  return (
    <div className={`reaction-bar${cooling ? ' cooling' : ''}`} role="group" aria-label="Thả cảm xúc lên màn hình lớn">
      {REACTIONS.map((emoji) => (
        <button key={emoji} type="button" className="reaction-btn" data-emoji={emoji} aria-label={emoji} onClick={handleReact}>
          <Emoji char={emoji} />
        </button>
      ))}
    </div>
  );
}
