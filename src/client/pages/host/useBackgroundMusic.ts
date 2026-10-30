import { useEffect, useState } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { startMusic, stopMusic } from '../../lib/bgm.ts';
import { readStorage, storageKeys, writeStorage } from '../../lib/storage.ts';

/** Music plays while the room waits and between questions; never over a question's audio or the results. */
const MUSIC_PHASES = ['lobby', 'leaderboard'];

/** The host screen's background music: on by default, switched off for good from the menu. */
export function useBackgroundMusic(state: HostState | null) {
  const [on, setOn] = useState(() => readStorage(storageKeys.music) !== '0');
  const wanted = on && state !== null && MUSIC_PHASES.includes(state.phase) && !state.pausedAt;

  useEffect(() => {
    if (wanted) startMusic();
    else stopMusic();
  }, [wanted]);

  // Leaving the host screen silences it.
  useEffect(() => stopMusic, []);

  function toggle() {
    writeStorage(storageKeys.music, on ? '0' : null);
    setOn(!on);
  }

  return { musicOn: on, toggleMusic: toggle };
}
