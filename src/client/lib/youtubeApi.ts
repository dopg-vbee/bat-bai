import { useEffect, useState } from 'react';

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<typeof YT> | null = null;

/** Loads the YouTube IFrame Player API once per page. */
export function loadYoutubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error('Không tải được YouTube'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

const durations = new Map<string, number>();
const DURATION_POLL_MS = 250;
const DURATION_MAX_TRIES = 24;

/** Video length in seconds, read from a throwaway hidden player; null until known. */
export function useYoutubeDuration(videoId: string | null): number | null {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    setDuration(videoId ? (durations.get(videoId) ?? null) : null);
    if (!videoId || durations.has(videoId)) return;
    let disposed = false;
    let player: YT.Player | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const probe = document.createElement('div');
    probe.className = 'yt-probe';
    document.body.append(probe);

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      player?.destroy();
      probe.remove();
    };

    loadYoutubeApi()
      .then((api) => {
        if (disposed) return;
        const mount = document.createElement('div');
        probe.append(mount);
        player = new api.Player(mount, {
          videoId,
          width: 200,
          height: 120,
          host: 'https://www.youtube-nocookie.com',
          events: {
            onReady: () => {
              let tries = 0;
              const check = () => {
                const length = player?.getDuration() ?? 0;
                if (length > 0) {
                  durations.set(videoId, length);
                  setDuration(length);
                  dispose();
                } else if (++tries < DURATION_MAX_TRIES) {
                  timer = setTimeout(check, DURATION_POLL_MS);
                } else {
                  dispose();
                }
              };
              check();
            },
          },
        });
      })
      .catch(dispose);

    return dispose;
  }, [videoId]);

  return duration;
}
