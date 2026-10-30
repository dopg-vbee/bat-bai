import { useEffect, useRef } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { playJoinSound, playLeaveSound } from '../../lib/sfx.ts';

/** A little "pop" on the big screen each time someone walks into the lobby, and its mirror when they leave. */
export function useLobbySounds(state: HostState | null) {
  /** Who was in the room, and who was online, at the last update; null until the first state arrives (opening the screen is silent). */
  const before = useRef<{ all: Set<string>; online: Set<string> } | null>(null);

  useEffect(() => {
    if (!state) return;
    const previous = before.current;
    const all = new Set(state.players.map((p) => p.id));
    const online = new Set(state.players.filter((p) => p.connected).map((p) => p.id));
    before.current = { all, online };
    if (!previous || state.phase !== 'lobby') return;
    const arrivals = [...all].filter((id) => !previous.all.has(id)).length;
    const departures = [...previous.online].filter((id) => !online.has(id)).length;
    if (arrivals > 0) playJoinSound(arrivals);
    else if (departures > 0) playLeaveSound();
  }, [state]);
}
