import type { MouseEvent } from 'react';
import { REACTIONS } from '../../../shared/types.ts';
import { Emoji } from '../../components/Emoji.tsx';
import { socket } from '../../lib/socket.ts';

const POP: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }];

/** Emoji to throw at the big screen once the player is done with the question (the server limits the rate). */
export function ReactionBar() {
  function handleReact(event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    socket.emit('player:react', button.dataset.emoji ?? '');
    button.animate(POP, { duration: 250 });
    navigator.vibrate?.(15);
  }

  return (
    <div className="reaction-bar" role="group" aria-label="Thả cảm xúc lên màn hình lớn">
      {REACTIONS.map((emoji) => (
        <button key={emoji} type="button" className="reaction-btn" data-emoji={emoji} onClick={handleReact}>
          <Emoji char={emoji} />
        </button>
      ))}
    </div>
  );
}
