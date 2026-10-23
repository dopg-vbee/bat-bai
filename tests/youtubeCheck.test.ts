import { describe, expect, it, vi } from 'vitest';
import { createVideoChecker } from '../src/server/youtubeCheck.ts';

/** A fake oEmbed answering with the given HTTP status per video id ('fail' = network error). */
function fakeYoutube(statuses: Record<string, number | 'fail'>) {
  return vi.fn(async (url: string | URL | Request) => {
    const status = statuses[String(url).slice(-11)];
    if (status === 'fail') throw new Error('offline');
    return new Response(null, { status });
  });
}

describe('video checker', () => {
  it('tells playable, blocked, missing and unknown videos apart', async () => {
    const fetchFn = fakeYoutube({ aaaaaaaaaaa: 200, bbbbbbbbbbb: 401, ccccccccccc: 404, ddddddddddd: 'fail' });
    const check = createVideoChecker(fetchFn);
    expect(await check(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'aaaaaaaaaaa'])).toEqual({
      aaaaaaaaaaa: 'ok',
      bbbbbbbbbbb: 'blocked',
      ccccccccccc: 'missing',
      ddddddddddd: 'unknown',
    });
    expect(fetchFn).toHaveBeenCalledTimes(4); // duplicates are asked once
  });

  it('keeps answers for an hour, retries failures, and re-asks when told to', async () => {
    let time = 0;
    const fetchFn = fakeYoutube({ aaaaaaaaaaa: 200, ddddddddddd: 'fail' });
    const check = createVideoChecker(fetchFn, () => time);
    await check(['aaaaaaaaaaa', 'ddddddddddd']);
    await check(['aaaaaaaaaaa', 'ddddddddddd']);
    expect(fetchFn).toHaveBeenCalledTimes(3); // the failure was asked again, the answer was not
    await check(['aaaaaaaaaaa'], { fresh: true });
    expect(fetchFn).toHaveBeenCalledTimes(4);
    time = 61 * 60_000;
    await check(['aaaaaaaaaaa']);
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });
});
