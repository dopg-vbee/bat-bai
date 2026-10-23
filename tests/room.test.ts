import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Room } from '../src/server/game/room.ts';

const questions = [
  { title: 'Lạc Trôi', audio: 'a'.repeat(64), youtubeId: 'Llw9Q6akRo4', startSec: 30, endSec: 50 },
  { title: 'Nơi Này Có Anh', audio: 'b'.repeat(64), youtubeId: 'Llw9Q6akRo4', startSec: 60, endSec: null },
];

const makeRoom = (preview: boolean) =>
  new Room({ code: '1234', setName: 'Test', questions, durationMs: 10_000, countdownMs: 3000, preview, onChange: () => {} });

describe('preview room', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with 8 online bots and no sockets to push to', () => {
    const room = makeRoom(true);
    const state = room.hostView();
    expect(state.preview).toBe(true);
    expect(state.players).toHaveLength(8);
    expect(state.players.every((p) => p.connected)).toBe(true);
    expect(room.playerViews()).toEqual([]);
  });

  it('bots answer during the round and the round ends early when all are right', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // never miss, answer at 10% + 0.5 × 70% = 45% of the round
    const room = makeRoom(true);
    room.next();
    expect(room.phase).toBe('question');
    vi.advanceTimersByTime(3000 + 4500 + 1300);
    expect(room.phase).toBe('reveal');
    const state = room.hostView();
    expect(state.correctFeed).toHaveLength(8);
    expect(state.leaderboard[0].score).toBe(775);
  });

  it('a missing bot leaves the round to run to the buzzer', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below the miss rate: nobody answers
    const room = makeRoom(true);
    room.next();
    vi.advanceTimersByTime(3000 + 9000);
    expect(room.phase).toBe('question');
    vi.advanceTimersByTime(1500);
    expect(room.phase).toBe('reveal');
    expect(room.hostView().correctFeed).toHaveLength(0);
  });

  it('pending bot answers are cancelled by an early reveal', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const room = makeRoom(true);
    room.next();
    room.reveal();
    vi.advanceTimersByTime(20_000);
    expect(room.hostView().correctFeed).toHaveLength(0);
  });

  it('a normal room has no bots', () => {
    expect(makeRoom(false).hostView().players).toHaveLength(0);
  });
});
