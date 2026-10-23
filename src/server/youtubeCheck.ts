import type { VideoStatus } from '../shared/types.ts';

const OEMBED_URL = 'https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=';
const CACHE_MS = 60 * 60_000;
const TIMEOUT_MS = 5000;
/** Videos checked at once, so a 50-question set doesn't fire 50 requests together. */
const CONCURRENCY = 4;

/** YouTube's oEmbed needs no API key: 401/403 = embedding turned off (or private), 400/404 = gone. */
function statusOf(httpStatus: number): VideoStatus {
  if (httpStatus === 200) return 'ok';
  if (httpStatus === 401 || httpStatus === 403) return 'blocked';
  if (httpStatus === 400 || httpStatus === 404) return 'missing';
  return 'unknown';
}

/** Checks whether videos can play inside the game; answers are kept an hour, failures are retried. */
export function createVideoChecker(fetchFn: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { status: VideoStatus; at: number }>();

  async function checkOne(id: string, fresh: boolean): Promise<VideoStatus> {
    const cached = cache.get(id);
    if (!fresh && cached && now() - cached.at < CACHE_MS) return cached.status;
    let status: VideoStatus;
    try {
      const res = await fetchFn(OEMBED_URL + id, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      status = statusOf(res.status);
    } catch {
      status = 'unknown';
    }
    if (status === 'unknown') cache.delete(id);
    else cache.set(id, { status, at: now() });
    return status;
  }

  return async function checkVideos(ids: string[], { fresh = false } = {}): Promise<Record<string, VideoStatus>> {
    const unique = [...new Set(ids)];
    const result: Record<string, VideoStatus> = {};
    for (let i = 0; i < unique.length; i += CONCURRENCY) {
      await Promise.all(
        unique.slice(i, i + CONCURRENCY).map(async (id) => {
          result[id] = await checkOne(id, fresh);
        }),
      );
    }
    return result;
  };
}
