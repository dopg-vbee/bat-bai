import type { HostState } from '../../../shared/types.ts';
import { useMusic } from '../../lib/useMusic.ts';

/** Music plays only while the room waits in the lobby; once the game starts the screen is silent. */
export function useBackgroundMusic(state: HostState | null) {
  return useMusic(state !== null && state.phase === 'lobby' && !state.pausedAt);
}
