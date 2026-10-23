import { CircleHelp, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { VideoStatus } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';

const PROBLEMS: Record<Exclude<VideoStatus, 'ok'>, string> = {
  blocked: 'Video bị chặn phát ngoài YouTube',
  missing: 'Video không tồn tại',
  unknown: 'Chưa kiểm tra được video',
};

/** Why a question's answer video won't play in the game; nothing when it plays (or isn't checked yet). */
export function VideoProblem({ status }: { status: VideoStatus | null | undefined }) {
  if (!status || status === 'ok') return null;
  return (
    <span className={`video-problem video-${status}`}>
      {status === 'unknown' ? <CircleHelp /> : <TriangleAlert />} {PROBLEMS[status]}
    </span>
  );
}

const CHECK_DELAY_MS = 500;

/** Status of one video, checked once the link has stopped changing for a moment. */
export function useVideoStatus(youtubeId: string | null): VideoStatus | null {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  useEffect(() => {
    setStatus(null);
    if (!youtubeId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api<{ status: VideoStatus }>(`/videos/${youtubeId}`)
        .then((res) => !cancelled && setStatus(res.status))
        .catch(() => !cancelled && setStatus('unknown'));
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [youtubeId]);
  return status;
}
