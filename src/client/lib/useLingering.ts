import { useEffect, useRef, useState } from 'react';

/**
 * Holds on to the last non-null `value` for `ms` after it becomes null, so something can animate out
 * instead of vanishing. `leaving` is true during that grace period.
 */
export function useLingering<T>(value: T | null, ms: number) {
  const last = useRef<T | null>(value);
  const [, rerender] = useState(0);
  if (value !== null) last.current = value;
  const gone = value === null;

  useEffect(() => {
    if (!gone || last.current === null) return;
    const timer = setTimeout(() => {
      last.current = null;
      rerender((n) => n + 1);
    }, ms);
    return () => clearTimeout(timer);
  }, [gone, ms]);

  return { value: value ?? last.current, leaving: gone && last.current !== null };
}
