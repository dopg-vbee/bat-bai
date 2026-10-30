import type { HostState } from '../../../shared/types.ts';
import { useMusic } from '../../lib/useMusic.ts';

/** Music plays while the room waits and between questions; never over a question's audio or the results. */
const MUSIC_PHASES = ['lobby', 'leaderboard'];

/** The host screen's background music: on by default, switched off for good from the menu. */
export function useBackgroundMusic(state: HostState | null) {
  return useMusic(state !== null && MUSIC_PHASES.includes(state.phase) && !state.pausedAt);
}
