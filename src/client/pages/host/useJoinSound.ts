import { useEffect, useRef } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { playJoinSound } from '../../lib/sfx.ts';

/** A little "pop" on the big screen each time someone new walks into the lobby. */
export function useJoinSound(state: HostState | null) {
  /** Who was in at the last update; null until the first state arrives, so opening the screen is silent. */
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!state) return;
    const before = known.current;
    known.current = new Set(state.players.map((p) => p.id));
    if (!before || state.phase !== 'lobby') return;
    const arrivals = state.players.filter((p) => !before.has(p.id) && !p.bot).length;
    if (arrivals > 0) playJoinSound(arrivals);
  }, [state]);
}
