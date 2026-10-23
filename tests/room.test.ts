import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickLuck, Room } from '../src/server/game/room.ts';
import { LEADERBOARD_MS, PREVIEW_BOTS } from '../src/shared/types.ts';

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
    vi.advanceTimersByTime(LEADERBOARD_MS);
    expect(room.phase).toBe('question');
    expect(room.qIndex).toBe(1);

    room.reveal();
    room.clipEnded(1);
    expect(room.phase).toBe('leaderboard');
    vi.advanceTimersByTime(LEADERBOARD_MS);
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

  it('pause freezes the round; resume continues where it left off', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // bots answer 4.5s into the round
    const room = makeRoom(true);
    room.next();
    vi.advanceTimersByTime(3000 + 2000);
    const endsAt = room.endsAt;

    room.pause();
    expect(room.hostView().pausedAt).toBeGreaterThan(0);
    vi.advanceTimersByTime(60_000); // nothing moves while paused: no bot answers, no buzzer
    expect(room.phase).toBe('question');
    expect(room.hostView().correctFeed).toHaveLength(0);

    room.resume();
    expect(room.hostView().pausedAt).toBe(0);
    expect(room.endsAt).toBe(endsAt + 60_000);
    vi.advanceTimersByTime(2500 + 450); // the rest of the bots' 4.5s, then the all-correct reveal
    expect(room.phase).toBe('reveal');
    // Points ignore the pause: answered 4.5s into a 10s round → 775, same as without pausing.
    expect(room.hostView().correctFeed[0].points).toBe(775);
  });

  it('guesses are refused while paused, and pausing outside a round does nothing', () => {
    const room = makeRoom(false);
    room.pause();
    expect(room.hostView().pausedAt).toBe(0); // lobby
    const player = room.join('Lan', undefined, 'socket-1');
    if (typeof player === 'string') throw new Error(player);
    room.next();
    vi.advanceTimersByTime(3000 + 1000);
    room.pause();
    expect(room.guess(player.id, 'Lạc Trôi')).toEqual({ status: 'paused' });
    room.next(); // host skips while paused: resumes, then reveals
    expect(room.hostView().pausedAt).toBe(0);
    expect(room.phase).toBe('reveal');
  });

  it('shows wrong guesses on the big screen only, newest last, reset each round', () => {
    const room = makeRoom(false);
    const lan = room.join('Lan', undefined, 'socket-1');
    if (typeof lan === 'string') throw new Error(lan);
    room.next();
    vi.advanceTimersByTime(3000 + 500);
    room.guess(lan.id, '  nơi   này có anh  ');
    vi.advanceTimersByTime(400);
    room.guess(lan.id, 'x'.repeat(80));
    const wrong = room.hostView().wrongFeed;
    expect(wrong.map((w) => w.text)).toEqual(['nơi này có anh', 'x'.repeat(40)]);
    expect(wrong[0]).toEqual({ key: '1', text: 'nơi này có anh' }); // anonymous: no player info
    expect(JSON.stringify(room.playerViews())).not.toContain('nơi này có anh');

    room.next(); // reveal
    room.next(); // leaderboard
    room.next(); // question 2
    expect(room.hostView().wrongFeed).toEqual([]);
  });

  it('lucky rounds score double, and are only revealed when they start', () => {
    const room = new Room({
      code: '1234', setName: 'Test', questions, durationMs: 10_000, countdownMs: 3000,
      luck: { doubleRounds: [1], giftChance: 0 }, onChange: () => {},
    });
    const lan = room.join('Lan', undefined, 's1');
    if (typeof lan === 'string') throw new Error(lan);
    room.next();
    expect(room.hostView().double).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(room.guess(lan.id, 'Lạc Trôi')).toEqual({ status: 'correct', points: 1000, gift: 0 });
    room.next(); room.next(); room.next(); // reveal → leaderboard → question 2
    expect(room.hostView().double).toBe(true);
    expect(room.playerViews()[0].state.double).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(room.guess(lan.id, 'Nơi Này Có Anh')).toEqual({ status: 'correct', points: 2000, gift: 0 });
  });

  it('a gift box adds a random bonus shown with the answer', () => {
    const room = new Room({
      code: '1234', setName: 'Test', questions, durationMs: 10_000, countdownMs: 3000,
      luck: { doubleRounds: [], giftChance: 1 }, onChange: () => {},
    });
    const lan = room.join('Lan', undefined, 's1');
    if (typeof lan === 'string') throw new Error(lan);
    room.next();
    vi.advanceTimersByTime(3000);
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // the largest gift
    expect(room.guess(lan.id, 'lac troi')).toEqual({ status: 'correct', points: 1300, gift: 300 });
    expect(room.hostView().correctFeed[0]).toMatchObject({ points: 1300, gift: 300 });
    expect(room.playerViews()[0].state.round).toEqual({ correct: true, points: 1300, gift: 300 });
  });

  it('a normal room has no bots', () => {
    expect(makeRoom(false).hostView().players).toHaveLength(0);
  });
});

describe('pickLuck', () => {
  it('picks about a fifth of the questions, never the first, no duplicates', () => {
    for (let run = 0; run < 50; run++) {
      const { doubleRounds, giftChance } = pickLuck(10);
      expect(doubleRounds).toHaveLength(2);
      expect(new Set(doubleRounds).size).toBe(2);
      expect(doubleRounds).not.toContain(0);
      expect(doubleRounds.every((i) => i >= 1 && i <= 9)).toBe(true);
      expect(giftChance).toBe(0.15);
    }
    expect(pickLuck(3).doubleRounds).toHaveLength(1);
    expect(pickLuck(2).doubleRounds).toEqual([]);
  });
});

describe('preview bot count', () => {
  it('honours the chosen number of bots, flagged as bots', () => {
    const room = new Room({ code: '1234', setName: 'T', questions: [], durationMs: 10_000, countdownMs: 3000, preview: true, bots: 100, onChange: () => {} });
    const players = room.hostView().players;
    expect(players).toHaveLength(100);
    expect(players.every((p) => p.bot)).toBe(true);
    expect(players[0].name).toBe('Bot Mít');
    expect(players[99].name).toBe('Bot 100');
    expect(typeof room.join('Lan', undefined, 's1')).not.toBe('string'); // real players still fit
  });
});
