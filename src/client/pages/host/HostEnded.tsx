import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { AnimatedEmoji } from '../../components/Emoji.tsx';
import { Leaderboard } from '../../components/Leaderboard.tsx';
import { Podium } from '../../components/Podium.tsx';
import { TeamBars, teamPodium } from '../../components/Team.tsx';
import { burst, celebrate, fireworks } from '../../lib/confetti.ts';
import { Link } from '../../lib/router.tsx';
import { playCorrectChime, playDrumroll, playFanfare, playPodiumHit, playWhoosh } from '../../lib/sfx.ts';
import { AWARD_STAGGER_MS, awardCards, Awards } from './Awards.tsx';

const START_MS = 500;
/** The spotlight swings onto a place before its drumroll starts. */
const AIM_MS = 600;
const ROLL_MS = 900;
const WINNER_ROLL_MS = 1800;
const AFTER_REVEAL_MS = 900;
const AFTER_WINNER_MS = 2200;
/** Each award card chimes as it pops in; everyone else is listed a moment after the last one. */
const AWARD_CHIME_MS = 150;
const AFTER_AWARDS_MS = 1500;

interface Spot {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Lit ellipse around a podium place, in page pixels. */
function spotOn(slot: Element): Spot {
  const rect = slot.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rx: rect.width * 0.8, ry: rect.height * 0.7 };
}

/**
 * Final results: the lights go down, a spotlight swings to 3rd, 2nd and 1st place in turn with a
 * drumroll before each, then the lights come back up on the award titles and everyone else.
 */
export function HostEnded({ state }: { state: HostState }) {
  // "Together" mode: teammates all score alike, so the teams take the podium.
  const byTeams = state.teamMode === 'together';
  const podium = byTeams ? teamPodium(state.teams) : state.leaderboard.slice(0, 3);
  const rest = byTeams ? [] : state.leaderboard.slice(3);
  const [revealFrom, setRevealFrom] = useState(3);
  const [lightsUp, setLightsUp] = useState(false);
  const [showRest, setShowRest] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const places = podium.length;
  const champion = state.teamMode === 'average' ? (state.teams[0] ?? null) : null;
  const cards = state.awards ? awardCards(state.awards, champion) : [];
  const cardCount = cards.length;

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

    function aim(place: number) {
      const slot = sectionRef.current?.querySelector(`.place-${place + 1}`);
      if (slot) setSpot(spotOn(slot));
      playWhoosh();
    }

    const timers: number[] = [];
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    let t = START_MS;
    for (let place = places - 1; place >= 0; place--) {
      const roll = place === 0 ? WINNER_ROLL_MS : ROLL_MS;
      at(t, () => aim(place));
      at(t + AIM_MS, () => playDrumroll(roll / 1000));
      at(t + AIM_MS + roll, () => reveal(place));
      t += AIM_MS + roll + (place === 0 ? AFTER_WINNER_MS : AFTER_REVEAL_MS);
    }
    at(t, () => {
      setLightsUp(true);
      if (places) playWhoosh();
    });
    for (let i = 0; i < cardCount; i++) at(t + i * AWARD_STAGGER_MS + AWARD_CHIME_MS, () => playCorrectChime(i));
    if (cardCount) t += cardCount * AWARD_STAGGER_MS + AFTER_AWARDS_MS;
    at(t, () => setShowRest(true));
    return () => timers.forEach(clearTimeout);
  }, [places, cardCount]);

  return (
    <section ref={sectionRef} className="host-ended">
      {spot && (
        <div
          className={`spotlight${lightsUp ? ' off' : ''}`}
          style={
            {
              '--spot-x': `${spot.x}px`,
              '--spot-y': `${spot.y}px`,
              '--spot-rx': `${spot.rx}px`,
              '--spot-ry': `${spot.ry}px`,
            } as CSSProperties
          }
          aria-hidden
        />
      )}
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
      {lightsUp && cardCount > 0 && <Awards cards={cards} />}
      {showRest && (
        <>
          {byTeams && <TeamBars teams={state.teams} />}
          {rest.length > 0 && <Leaderboard rows={rest} />}
          <Link to="/admin" className="btn btn-ghost">
            <ArrowLeft /> Về trang quản lý
          </Link>
        </>
      )}
    </section>
  );
}
