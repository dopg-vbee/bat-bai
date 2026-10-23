import { useLayoutEffect, useState, type CSSProperties } from 'react';
import type { ClipInfo } from '../../../shared/types.ts';
import { YoutubeClip } from '../../components/YoutubeClip.tsx';
import { socket } from '../../lib/socket.ts';

interface HostClipProps {
  qIndex: number;
  clip: ClipInfo;
  title: string;
  active: boolean;
  /** Placeholder in the reveal layout that the player is drawn over. */
  slot: HTMLElement | null;
}

/**
 * Lives for the whole round so the player started during the question (hidden, muted,
 * pre-buffering HD) is the same one shown at reveal: moving an iframe in the DOM reloads it,
 * so instead of moving it we position it over the reveal layout's slot.
 */
export function HostClip({ qIndex, clip, title, active, slot }: HostClipProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // The server moves on to the leaderboard when the answer clip is over.
  function handleEnded() {
    socket.emit('host:clipEnded', qIndex);
  }

  useLayoutEffect(() => {
    if (!active || !slot) {
      setRect(null);
      return;
    }
    const update = () => setRect(slot.getBoundingClientRect());
    update();
    const observer = new ResizeObserver(update);
    observer.observe(slot);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, slot]);

  const style: CSSProperties | undefined = rect ? { top: rect.top, left: rect.left, width: rect.width } : undefined;
  return (
    <div className={rect ? 'host-clip' : 'host-clip warming'} style={style} aria-hidden={!rect}>
      <YoutubeClip
        youtubeId={clip.youtubeId}
        startSec={clip.startSec}
        endSec={clip.endSec}
        title={title}
        active={rect !== null}
        showControls={false}
        onEnded={handleEnded}
      />
    </div>
  );
}
