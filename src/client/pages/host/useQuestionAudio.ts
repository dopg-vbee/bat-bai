import { useEffect, useRef, useState } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { serverNow } from '../../lib/socket.ts';

export interface QuestionAudio {
  playing: boolean;
  /** The browser refused autoplay; the host has to press play once. */
  blocked: boolean;
  replay: () => void;
}

/** Plays the round's MP3 on the big screen at the server's start instant and warms the next one. */
export function useQuestionAudio(state: HostState | null): QuestionAudio {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const phase = state?.phase;
  const qIndex = state?.qIndex;
  const startsAt = state?.startsAt ?? 0;
  const src = state?.audioUrl ?? null;
  const nextSrc = state?.nextAudioUrl ?? null;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    const update = () => setPlaying(!audio.paused && !audio.ended);
    audio.addEventListener('play', update);
    audio.addEventListener('pause', update);
    audio.addEventListener('ended', update);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  function play() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio
      .play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (phase !== 'question' || !src) {
      audio.pause();
      return;
    }
    const absolute = new URL(src, location.href).href;
    if (audio.src !== absolute) {
      audio.src = absolute;
      audio.load();
    }
    const timer = setTimeout(play, Math.max(0, startsAt - serverNow()));
    return () => clearTimeout(timer);
  }, [phase, qIndex, src, startsAt]);

  // Warm the HTTP cache (files are immutable) so the next round starts instantly.
  useEffect(() => {
    if (nextSrc) fetch(nextSrc).catch(() => undefined);
  }, [nextSrc]);

  return { playing, blocked, replay: play };
}
