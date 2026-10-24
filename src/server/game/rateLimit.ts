/** At most `max` events per `windowMs` for each key, over a sliding window. */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
      const allowed = recent.length < max;
      if (allowed) recent.push(now);
      hits.set(key, recent);
      return allowed;
    },
    forget(key: string) {
      hits.delete(key);
    },
  };
}
