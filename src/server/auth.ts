import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function checkPassword(given: unknown, expected: string): boolean {
  return typeof given === 'string' && timingSafeEqual(digest(given), digest(expected));
}
