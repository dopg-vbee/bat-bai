import { useEffect } from 'react';
import { AnimatedEmoji } from '../../components/Emoji.tsx';
import { fireworks } from '../../lib/confetti.ts';
import { playFanfare } from '../../lib/sfx.ts';

/** Full-screen "everyone got it" moment over the start of the reveal; fades out on its own. */
export function AllCorrectCelebration() {
  useEffect(() => {
    playFanfare();
    fireworks();
  }, []);

  return (
    <div className="all-correct" aria-live="polite">
      <AnimatedEmoji char="💯" className="all-correct-emoji" />
      <p className="all-correct-text">Cả phòng đều đúng!</p>
    </div>
  );
}
