import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../src/server/game/rateLimit.ts';

describe('rate limiter', () => {
  it('lets a few through per window, per key, and forgets a key on request', () => {
    const limit = createRateLimiter(3, 2000);
    expect([0, 100, 200, 300].map((t) => limit.allow('a', t))).toEqual([true, true, true, false]);
    expect(limit.allow('b', 300)).toBe(true); // keys are independent
    expect(limit.allow('a', 2050)).toBe(true); // the first hit has left the window
    expect(limit.allow('a', 2060)).toBe(false);
    limit.forget('a');
    expect(limit.allow('a', 2070)).toBe(true);
  });
});
