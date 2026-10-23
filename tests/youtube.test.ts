import { describe, expect, it } from 'vitest';
import { formatRange, formatTimestamp, parseTimestamp, parseYoutube } from '../src/shared/youtube.ts';

describe('parseYoutube', () => {
  const id = 'Llw9Q6akRo4';

  it.each([
    [`https://www.youtube.com/watch?v=${id}`, 0],
    [`https://www.youtube.com/watch?v=${id}&t=75`, 75],
    [`https://youtube.com/watch?v=${id}&t=1m15s`, 75],
    [`https://youtu.be/${id}?t=90`, 90],
    [`youtu.be/${id}?si=abc&t=1h2m3s`, 3723],
    [`https://m.youtube.com/watch?v=${id}#t=30`, 30],
    [`https://music.youtube.com/watch?v=${id}&list=RD&t=12s`, 12],
    [`https://www.youtube.com/shorts/${id}`, 0],
    [`https://www.youtube.com/embed/${id}?start=45`, 45],
    [`https://www.youtube.com/live/${id}?t=10`, 10],
  ])('%s → start %i', (url, start) => {
    expect(parseYoutube(url)).toEqual({ id, start, end: null });
  });

  it('reads an end time from embed links, ignoring one before the start', () => {
    expect(parseYoutube(`https://www.youtube.com/embed/${id}?start=45&end=70`)).toEqual({ id, start: 45, end: 70 });
    expect(parseYoutube(`https://www.youtube.com/embed/${id}?start=45&end=30`)).toEqual({ id, start: 45, end: null });
  });

  it.each(['', 'hello', 'https://vimeo.com/123', 'https://notyoutube.com/watch?v=Llw9Q6akRo4', 'https://youtu.be/short'])(
    'rejects %s',
    (url) => {
      expect(parseYoutube(url)).toBeNull();
    },
  );
});

describe('timestamps', () => {
  it.each([
    ['90', 90],
    ['90s', 90],
    ['1:30', 90],
    ['01:02:03', 3723],
    ['2m', 120],
    ['1h', 3600],
    ['75.3', 75.3],
    ['75.34', 75.3],
    ['1:15.3', 75.3],
    ['1:02:03.5', 3723.5],
  ])('parses %s', (input, expected) => {
    expect(parseTimestamp(input)).toBe(expected);
  });

  it('rejects garbage', () => {
    expect(parseTimestamp('abc')).toBeNull();
    expect(parseTimestamp('1:2:3:4')).toBeNull();
  });

  it('formats', () => {
    expect(formatTimestamp(75)).toBe('1:15');
    expect(formatTimestamp(3723)).toBe('1:02:03');
    expect(formatTimestamp(5)).toBe('0:05');
    expect(formatTimestamp(75.3)).toBe('1:15.3');
    expect(formatTimestamp(59.96)).toBe('1:00');
    expect(formatTimestamp(0.1 + 0.2)).toBe('0:00.3');
    expect(formatRange(75, 105)).toBe('1:15 – 1:45');
    expect(formatRange(75, null)).toBe('từ 1:15');
  });
});
