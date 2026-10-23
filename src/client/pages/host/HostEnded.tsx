import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { AnimatedEmoji } from '../../components/Emoji.tsx';
import { Leaderboard } from '../../components/Leaderboard.tsx';
import { Podium } from '../../components/Podium.tsx';
import { burst, celebrate, fireworks } from '../../lib/confetti.ts';
import { Link } from '../../lib/router.tsx';
import { playDrumroll, playFanfare, playPodiumHit } from '../../lib/sfx.ts';

const START_MS = 500;
const ROLL_MS = 900;
const WINNER_ROLL_MS = 1800;
const AFTER_REVEAL_MS = 900;
const AFTER_WINNER_MS = 2200;

/** Final results: a drumroll before each of 3rd, 2nd and 1st place, then everyone else. */
export function HostEnded({ state }: { state: HostState }) {
  const podium = state.leaderboard.slice(0, 3);
  const rest = state.leaderboard.slice(3);
  const [revealFrom, setRevealFrom] = useState(3);
  const [showRest, setShowRest] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const places = podium.length;

  useEffect(() => {
    function reveal(place: number) {
      setRevealFrom(place);
      if (place === 0) {
        playFanfare();
        celebrate(4000);
        fireworks(2500);
        return;
      }
      playPodiumHit(place);
      const avatar = sectionRef.current?.querySelector(`.place-${place + 1} .avatar`)?.getBoundingClientRect();
      if (avatar)
        burst({
          x: (avatar.left + avatar.width / 2) / innerWidth,
          y: (avatar.top + avatar.height / 2) / innerHeight,
        });
    }

    const timers: number[] = [];
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    let t = START_MS;
    for (let place = places - 1; place >= 0; place--) {
      const roll = place === 0 ? WINNER_ROLL_MS : ROLL_MS;
      at(t, () => playDrumroll(roll / 1000));
      at(t + roll, () => reveal(place));
      t += roll + (place === 0 ? AFTER_WINNER_MS : AFTER_REVEAL_MS);
    }
    at(t, () => setShowRest(true));
    return () => timers.forEach(clearTimeout);
  }, [places]);

  return (
    <section ref={sectionRef} className="host-ended">
      <h1 className="ended-title">
        {revealFrom === 0 ? (
          <>
            <AnimatedEmoji char="🏆" className="ended-trophy" /> Chúc mừng nhà vô địch!
          </>
        ) : (
          'Kết quả chung cuộc'
        )}
      </h1>
      <Podium entries={podium} large revealFrom={revealFrom} />
      {showRest && (
        <>
          {rest.length > 0 && <Leaderboard rows={rest} />}
          <Link to="/admin" className="btn btn-ghost">
            <ArrowLeft /> Về trang quản lý
          </Link>
        </>
      )}
    </section>
  );
}
