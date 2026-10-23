import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Room } from '../src/server/game/room.ts';
import { PREVIEW_BOTS } from '../src/shared/types.ts';

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

  it('starts with online bots and no sockets to push to', () => {
    const room = makeRoom(true);
    const state = room.hostView();
    expect(state.preview).toBe(true);
    expect(state.players).toHaveLength(PREVIEW_BOTS);
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
    expect(state.correctFeed).toHaveLength(PREVIEW_BOTS);
    expect(state.correctFeed[0].points).toBe(775);
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

  it('runs the round by itself: reveal → leaderboard → next question → podium', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const room = makeRoom(true);
    room.next();
    vi.advanceTimersByTime(3000 + 4500 + 1300);
    expect(room.phase).toBe('reveal');

    // No "clip ended" from the big screen: the fallback (20s clip + 12s) still moves on.
    vi.advanceTimersByTime(20_000 + 12_000);
    expect(room.phase).toBe('leaderboard');
    expect(room.hostView().leaderboard).toHaveLength(PREVIEW_BOTS);
    vi.advanceTimersByTime(6000);
    expect(room.phase).toBe('question');
    expect(room.qIndex).toBe(1);

    room.reveal();
    room.clipEnded(1);
    expect(room.phase).toBe('leaderboard');
    vi.advanceTimersByTime(6000);
    expect(room.phase).toBe('ended');
  });

  it('moves on almost at once when everyone is right, and flags it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // every bot answers at 45% of the round
    const room = makeRoom(true);
    room.next();
    vi.advanceTimersByTime(3000 + 4500);
    expect(room.phase).toBe('question');
    vi.advanceTimersByTime(450);
    expect(room.phase).toBe('reveal');
    expect(room.hostView().allCorrect).toBe(true);

    room.next(); // → leaderboard
    room.next(); // → question 2: the flag resets
    expect(room.hostView().allCorrect).toBe(false);
  });

  it('does not flag a round that simply ran out of time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // nobody answers
    const room = makeRoom(true);
    room.next();
    vi.advanceTimersByTime(3000 + 10_000 + 400);
    expect(room.phase).toBe('reveal');
    expect(room.hostView().allCorrect).toBe(false);
  });

  it('a normal room has no bots', () => {
    expect(makeRoom(false).hostView().players).toHaveLength(0);
  });
});
