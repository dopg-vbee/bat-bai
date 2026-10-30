import { useEffect, useState } from 'react';
import { startMusic, stopMusic } from './bgm.ts';
import { readStorage, storageKeys, writeStorage } from './storage.ts';

/**
 * Background music for a screen: plays while `active` (and the user has not switched it off, which is
 * remembered across screens), and stops when the screen goes away.
 */
export function useMusic(active: boolean) {
  const [on, setOn] = useState(() => readStorage(storageKeys.music) !== '0');
  const wanted = on && active;

  useEffect(() => {
    if (wanted) startMusic();
    else stopMusic();
  }, [wanted]);

  useEffect(() => stopMusic, []);

  function toggle() {
    writeStorage(storageKeys.music, on ? '0' : null);
    setOn(!on);
  }

  return { musicOn: on, toggleMusic: toggle };
}
