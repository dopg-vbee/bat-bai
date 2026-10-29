import { Clapperboard, ExternalLink, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { OPEN_CLIP_SEC } from '../../shared/types.ts';
import { formatRange, youtubeWatchUrl } from '../../shared/youtube.ts';
import { loadYoutubeApi } from '../lib/youtubeApi.ts';

interface YoutubeClipProps {
  youtubeId: string;
  startSec: number;
  endSec: number | null;
  title: string;
  /** false = pre-buffer silently (see WARMUP_LEAD_SEC); true = play the clip with sound. */
  active?: boolean;
  /** false = bare video for the big screen: no range label, no replay buttons. */
  showControls?: boolean;
  /** Button style for the surface the clip sits on. */
  tone?: 'light' | 'dark';
  /** The clip reached its end (or cannot play at all). */
  onEnded?: () => void;
  /** Host paused the game: hold the video where it is, continue when false again. */
  paused?: boolean;
  /** The video is on its way out (its picture fades): bring the sound down with it. */
  fadeOut?: boolean;
}

type Status = 'loading' | 'playing' | 'stopped' | 'blocked' | 'error';

// The player is laid out at full 1080p size so YouTube streams HD, then scaled down with CSS.
// It is taller than 16:9: the video letterboxes in the middle and YouTube's title bar
// (top) and "More videos" / logo (bottom) land in the extra bands, which the frame crops.
const SOURCE_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const CROP = 260;
const PLAYING = 1;
const ENDED = 0;
const END_POLL_MS = 150;
const AUTOPLAY_TIMEOUT_MS = 2500;
/** Keep our cover up a moment after playback starts, over YouTube's play/pause flash. */
const START_FLASH_MS = 250;
/**
 * While players are guessing, the host pre-loads the clip silently: it plays the seconds
 * before it (so YouTube has measured the bandwidth) and waits paused at the clip start.
 * At reveal it starts instantly and reaches HD within about a second.
 */
const WARMUP_LEAD_SEC = 8;
const WARMUP_STOP_EARLY_SEC = 0.3;
/** Already parked this close before the start (warm-up done): play on without seeking. */
const NO_SEEK_WINDOW_SEC = 1.5;
const ERROR_END_DELAY_MS = 4000;
/**
 * The sound fades in just before the start mark and out just after the end mark, so the marks the question's
 * author set are heard at full volume. YouTube only takes volume steps.
 */
const FADE_IN_MS = 500;
const FADE_OUT_MS = 400;
const FADE_STEP_MS = 50;

/** Where playback begins: the fade-in leads up to the start mark. */
const playFrom = (startSec: number) => Math.max(0, startSec - FADE_IN_MS / 1000);

/** Bare video + audio for [startSec, endSec] (OPEN_CLIP_SEC when there is no end): no YouTube chrome. */
export function YoutubeClip({
  youtubeId,
  startSec,
  endSec,
  title,
  active = true,
  showControls = true,
  tone = 'light',
  onEnded,
  paused = false,
  fadeOut = false,
}: YoutubeClipProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const optionsRef = useRef({ startSec, endSec, active });
  const onEndedRef = useRef(onEnded);
  const [scale, setScale] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const statusRef = useRef(status);
  /** Consecutive polls that found the player playing since the last play(). */
  const playingPollsRef = useRef(0);
  const fadeRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const fadingInRef = useRef(false);
  const fadingOutRef = useRef(false);

  optionsRef.current = { startSec, endSec, active };
  onEndedRef.current = onEnded;
  statusRef.current = status;

  function later(fn: () => void, ms: number) {
    timersRef.current.push(setTimeout(fn, ms));
  }

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  /** Moves the volume to `target` over `ms`, replacing any fade under way (from `from`: getVolume lags a set). */
  function fadeTo(target: number, ms: number, from = playerRef.current?.getVolume() ?? 100) {
    clearInterval(fadeRef.current);
    const player = playerRef.current;
    if (!player) return;
    if (ms <= 0) return player.setVolume(target);
    const startedAt = performance.now();
    fadeRef.current = setInterval(() => {
      const done = Math.min(1, (performance.now() - startedAt) / ms);
      player.setVolume(Math.round(from + (target - from) * done));
      if (done >= 1) clearInterval(fadeRef.current);
    }, FADE_STEP_MS);
  }

  /** Plays the clip from its start, with sound. */
  function play() {
    const player = playerRef.current;
    if (!player) return;
    clearTimers();
    setStatus('loading');
    playingPollsRef.current = 0;
    fadingInRef.current = false;
    fadingOutRef.current = false;
    player.unMute();
    player.setVolume(0); // the poll brings it up when the video reaches the fade-in point
    const from = playFrom(optionsRef.current.startSec);
    // A seek throws away the decoded frames and can rebuffer; skip it when the warm-up
    // already parked the video just before where it starts.
    const time = player.getCurrentTime();
    if (!(time >= from - NO_SEEK_WINDOW_SEC && time <= from + 0.2)) player.seekTo(from, true);
    player.playVideo();
    later(() => {
      if (player.getPlayerState() !== PLAYING) setStatus((s) => (s === 'loading' ? 'blocked' : s));
    }, AUTOPLAY_TIMEOUT_MS);
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / SOURCE_WIDTH));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // One player per video; range changes and activation only seek/play (see below).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    setStatus('loading');

    loadYoutubeApi()
      .then((api) => {
        if (cancelled) return;
        const warmupFrom = Math.max(0, playFrom(optionsRef.current.startSec) - WARMUP_LEAD_SEC);
        // YouTube replaces this node with its iframe, so React never owns it.
        const mount = document.createElement('div');
        host.append(mount);
        const player = new api.Player(mount, {
          videoId: youtubeId,
          width: SOURCE_WIDTH,
          height: VIDEO_HEIGHT + 2 * CROP,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            start: Math.floor(optionsRef.current.active ? playFrom(optionsRef.current.startSec) : warmupFrom),
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            rel: 0,
            playsinline: 1,
            cc_load_policy: 0,
          },
          events: {
            onReady: () => {
              playerRef.current = player;
              if (optionsRef.current.active) return play();
              player.mute();
              player.seekTo(warmupFrom, true);
              player.playVideo();
            },
            onStateChange: (event) => {
              if (!optionsRef.current.active) return;
              if (event.data === PLAYING) later(() => setStatus('playing'), START_FLASH_MS);
              else if (event.data === ENDED) setStatus('stopped');
            },
            onError: () => setStatus('error'),
          },
        });
        // We stop at the marks ourselves: YouTube's own `end` shows its related-videos screen.
        poll = setInterval(() => {
          if (playerRef.current !== player || player.getPlayerState() !== PLAYING) {
            playingPollsRef.current = 0;
            return;
          }
          const { startSec: start, endSec: end, active: isActive } = optionsRef.current;
          // Revealed while the warm-up was still running just before the start: play() only unmutes,
          // and YouTube sends no new "playing" event. Lift the cover once it has kept playing a moment.
          playingPollsRef.current++;
          if (isActive && statusRef.current === 'loading' && playingPollsRef.current * END_POLL_MS > START_FLASH_MS) {
            setStatus('playing');
          }
          const time = player.getCurrentTime();
          const endMark = end ?? start + OPEN_CLIP_SEC;
          const from = playFrom(start);
          // Silent until the video reaches the fade-in point (it may still be playing muted from the warm-up).
          if (isActive && !fadingInRef.current && time >= from - (END_POLL_MS / 1000) * 1.5) {
            fadingInRef.current = true;
            later(() => fadeTo(100, (start - from) * 1000, 0), Math.max(0, (from - time) * 1000));
          }
          // The poll is coarse: when the end mark is about to pass, schedule the fade for the moment it does.
          if (isActive && !fadingOutRef.current && time >= endMark - (END_POLL_MS / 1000) * 1.5) {
            fadingOutRef.current = true;
            later(() => fadeTo(0, FADE_OUT_MS), Math.max(0, (endMark - time) * 1000));
          }
          if (!isActive && time >= from - WARMUP_STOP_EARLY_SEC) {
            player.pauseVideo();
          } else if (isActive && time >= endMark + FADE_OUT_MS / 1000) {
            player.pauseVideo();
            clearTimers();
            setStatus('stopped');
          }
        }, END_POLL_MS);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(fadeRef.current);
      clearTimers();
      playerRef.current?.destroy();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [youtubeId]);

  useEffect(() => {
    if (active) play();
  }, [active, startSec, endSec]);

  useEffect(() => {
    if (fadeOut) fadeTo(0, 300);
  }, [fadeOut]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !active) return;
    if (paused) player.pauseVideo();
    else if (status !== 'stopped' && status !== 'error') player.playVideo();
  }, [paused]);

  // A clip that cannot play still "ends", after a moment so the answer title stays on screen.
  useEffect(() => {
    if (!active) return;
    if (status === 'stopped') onEndedRef.current?.();
    if (status !== 'error') return;
    const timer = setTimeout(() => onEndedRef.current?.(), ERROR_END_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, active]);

  return (
    <div className="yt-clip">
      <div className="video-frame" ref={frameRef}>
        <div
          className="yt-stage"
          style={{ width: SOURCE_WIDTH, height: VIDEO_HEIGHT + 2 * CROP, transform: `scale(${scale}) translateY(-${CROP}px)` }}
          ref={hostRef}
        />
        {status !== 'playing' && (
          <div className="yt-cover" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg)` }}>
            {status === 'loading' && <div className="spinner" />}
            {status === 'stopped' && showControls && (
              <button type="button" className="btn btn-primary btn-lg" onClick={play}>
                <RotateCcw /> Phát lại
              </button>
            )}
            {status === 'blocked' && (
              <button type="button" className="btn btn-primary btn-lg" onClick={play}>
                <Play /> Bấm để phát
              </button>
            )}
            {status === 'error' && (
              <a className="btn btn-ghost" href={youtubeWatchUrl(youtubeId, startSec)} target="_blank" rel="noreferrer">
                Video này không phát được – mở trên YouTube <ExternalLink />
              </a>
            )}
          </div>
        )}
      </div>
      {showControls && (
        <div className="yt-clip-bar">
          <span className="yt-clip-range" title={title}>
            <Clapperboard /> {formatRange(startSec, endSec)}
          </span>
          <button type="button" className={`btn btn-sm ${tone === 'dark' ? 'btn-ghost' : 'btn-ghost-dark'}`} onClick={play}>
            <RotateCcw /> Phát lại đoạn này
          </button>
        </div>
      )}
    </div>
  );
}
