import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickLuck } from '../src/server/game/luck.ts';
import { Room } from '../src/server/game/room.ts';
import { LEADERBOARD_MS, PREVIEW_BOTS, streakBonus } from '../src/shared/types.ts';

const questions = [
  { title: 'Lạc Trôi', audio: 'a'.repeat(64), youtubeId: 'Llw9Q6akRo4', startSec: 30, endSec: 50 },
  { title: 'Nơi Này Có Anh', audio: 'b'.repeat(64), youtubeId: 'Llw9Q6akRo4', startSec: 60, endSec: null },
];

/** Question 2 isn't the final (x3) one here. */
const threeQuestions = [...questions, { ...questions[0], title: 'Hãy Trao Cho Anh' }];

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

  it('missing bots leave the round to run to the buzzer; the sure bot still answers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below the miss rate: every other bot misses
    const room = makeRoom(true);
    room.next();
    vi.advanceTimersByTime(3000 + 9000);
    expect(room.phase).toBe('question');
    vi.advanceTimersByTime(1500);
    expect(room.phase).toBe('reveal');
    expect(room.hostView().correctFeed.map((e) => e.name)).toEqual(['Bot Luôn Đúng']);
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

  it('lucky rounds score double, the final one triple, only revealed when they start', () => {
    const room = new Room({
      code: '1234', setName: 'Test', questions: threeQuestions, durationMs: 10_000, countdownMs: 3000,
      luck: { doubleRounds: [1], giftChances: [0, 0, 0], stealShare: 0 }, onChange: () => {},
    });
    const lan = room.join('Lan', undefined, 's1');
    if (typeof lan === 'string') throw new Error(lan);
    room.next();
    expect(room.hostView().multiplier).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(room.guess(lan.id, 'Lạc Trôi')).toEqual({ status: 'correct', points: 1000, gift: 0, streak: 1, stolenFrom: null });
    room.next(); room.next(); room.next(); // reveal → leaderboard → question 2
    expect(room.hostView().multiplier).toBe(2);
    expect(room.playerViews()[0].state.multiplier).toBe(2);
    vi.advanceTimersByTime(3000);
    expect(room.guess(lan.id, 'Nơi Này Có Anh')).toEqual({ status: 'correct', points: 2000, gift: 0, streak: 2, stolenFrom: null });
    room.next(); room.next(); room.next(); // the last question
    expect(room.hostView().multiplier).toBe(3);
    vi.advanceTimersByTime(3000);
    expect(room.guess(lan.id, 'Hãy Trao Cho Anh')).toMatchObject({ points: 3000 + 50 }); // + streak of 3
  });

  it('a one-question preview is not a final', () => {
    const room = new Room({
      code: '1234', setName: 'Test', questions: [questions[0]], durationMs: 10_000, countdownMs: 3000, onChange: () => {},
    });
    room.next();
    expect(room.hostView().multiplier).toBe(1);
  });

  it('a gift box adds a random bonus shown with the answer', () => {
    const room = new Room({
      code: '1234', setName: 'Test', questions, durationMs: 10_000, countdownMs: 3000,
      luck: { doubleRounds: [], giftChances: [1, 1, 1], stealShare: 0 }, onChange: () => {},
    });
    const lan = room.join('Lan', undefined, 's1');
    if (typeof lan === 'string') throw new Error(lan);
    room.next();
    vi.advanceTimersByTime(3000);
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // the largest gift
    expect(room.guess(lan.id, 'lac troi')).toEqual({ status: 'correct', points: 1150, gift: 150, streak: 1, stolenFrom: null });
    expect(room.hostView().correctFeed[0]).toMatchObject({ points: 1150, gift: 150 });
    expect(room.playerViews()[0].state.round).toEqual({
      correct: true, points: 1150, gift: 150, stolenFrom: null, robbed: 0, streak: 1, byTeam: false,
    });
  });

  it('gift chances follow the standings at the start of the question: ties share a third', () => {
    const titles = ['Lạc Trôi', 'Nơi Này Có Anh'];
    const room = new Room({
      code: '1234', setName: 'Test', questions: titles.map((title) => ({ ...questions[0], title })),
      durationMs: 10_000, countdownMs: 3000, luck: { doubleRounds: [], giftChances: [0, 0, 1], stealShare: 0 }, onChange: () => {},
    });
    const [lan, minh, an] = ['Lan', 'Minh', 'An'].map((name, i) => {
      const player = room.join(name, undefined, `s${i}`);
      if (typeof player === 'string') throw new Error(player);
      return player;
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // a 100 gift whenever the chance allows
    room.next();
    vi.advanceTimersByTime(3000);
    // Everyone on 0: all in the top third, no gifts.
    expect(room.guess(lan.id, titles[0])).toMatchObject({ gift: 0 });
    vi.advanceTimersByTime(1000);
    expect(room.guess(minh.id, titles[0])).toMatchObject({ gift: 0 });
    room.next(); room.next(); room.next(); // reveal → leaderboard → question 2
    vi.advanceTimersByTime(3000);
    // Lan 1st, Minh 2nd, An (no points) last: only An is in the bottom third.
    expect([lan, minh, an].map((p) => (room.guess(p.id, titles[1]) as { gift: number }).gift)).toEqual([0, 0, 100]);
  });

  it('a gift box can steal from the leader at the start of the question, once a question, not in team play', () => {
    const titles = ['Lạc Trôi', 'Nơi Này Có Anh', 'Hãy Trao Cho Anh'];
    const luck = { doubleRounds: [], giftChances: [1, 1, 1], stealShare: 1 };
    const makeRoom = (teamMode: 'off' | 'average') => {
      const room = new Room({
        code: '1234', setName: 'Test', questions: titles.map((title) => ({ ...questions[0], title })),
        durationMs: 10_000, countdownMs: 3000, luck, teamMode, teamCount: 2, onChange: () => {},
      });
      const players = ['Lan', 'Minh', 'An'].map((name, i) => {
        const player = room.join(name, undefined, `s${i}`);
        if (typeof player === 'string') throw new Error(player);
        room.setTeam(player.id, i % 2);
        return player;
      });
      return { room, players };
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // gift 100; a steal takes 75
    const { room, players: [lan, minh, an] } = makeRoom('off');
    room.next();
    vi.advanceTimersByTime(3000);
    // Nobody has points yet: nothing to steal.
    expect(room.guess(lan.id, titles[0])).toMatchObject({ points: 1100, gift: 100, stolenFrom: null });
    room.next(); room.next(); room.next(); // reveal → leaderboard → question 2
    vi.advanceTimersByTime(3000);
    // The leader's own box is a plain gift; anyone else's takes from the leader.
    expect(room.guess(lan.id, titles[1])).toMatchObject({ gift: 100, stolenFrom: null });
    expect(room.guess(minh.id, titles[1])).toMatchObject({ points: 1075, gift: 75, stolenFrom: 'Lan' });
    // Only one steal a question: the next box is a plain gift.
    expect(room.guess(an.id, titles[1])).toMatchObject({ gift: 100, stolenFrom: null });
    expect(lan.score).toBe(1100 + 1100 - 75);
    expect(room.hostView().correctFeed[1]).toMatchObject({ name: 'Minh', stolenFrom: 'Lan' });
    expect(room.playerViews().find((v) => v.socketId === 's0')!.state.round).toMatchObject({ robbed: 75 });
    room.next(); room.next(); // reveal → leaderboard: the stolen points come off this round's gain
    expect(room.hostView().leaderboard.map((r) => [r.name, r.roundPoints])).toEqual([
      ['Lan', 1025],
      ['An', 1100],
      ['Minh', 1075],
    ]);

    const teams = makeRoom('average');
    teams.room.next();
    vi.advanceTimersByTime(3000);
    teams.room.guess(teams.players[0].id, titles[0]);
    teams.room.next(); teams.room.next(); teams.room.next();
    vi.advanceTimersByTime(3000);
    expect(teams.room.guess(teams.players[1].id, titles[1])).toMatchObject({ gift: 100, stolenFrom: null });
  });

  it('counts correct answers in a row: a bonus from the third, kept while a question is open, reset by a miss', () => {
    const titles = ['Lạc Trôi', 'Nơi Này Có Anh', 'Hãy Trao Cho Anh', 'Bạc Phận'];
    const room = new Room({
      code: '1234', setName: 'Test', questions: titles.map((title) => ({ ...questions[0], title })),
      durationMs: 10_000, countdownMs: 3000, onChange: () => {},
    });
    const lan = room.join('Lan', undefined, 's1');
    if (typeof lan === 'string') throw new Error(lan);
    const streakOnPhone = () => room.playerViews()[0].state.round.streak;
    const answer = (index: number) => {
      vi.advanceTimersByTime(3000); // countdown: answering at once scores the full 1000
      return room.guess(lan.id, titles[index]);
    };
    room.next();
    expect(answer(0)).toMatchObject({ points: 1000, streak: 1 });
    room.next(); room.next(); room.next(); // reveal → leaderboard → question 2
    expect(answer(1)).toMatchObject({ points: 1000, streak: 2 });
    room.next(); room.next(); room.next();
    expect(answer(2)).toMatchObject({ points: 1050, streak: 3 }); // + streak bonus
    expect(room.hostView().correctFeed[0].streak).toBe(3);
    room.next(); room.next(); // reveal → leaderboard
    expect(room.hostView().leaderboard[0].streak).toBe(3);
    room.next(); // question 4, not answered yet
    expect(streakOnPhone()).toBe(3);
    room.next(); // reveal: missed
    expect(streakOnPhone()).toBe(0);
  });

  it('hands out the end-of-game titles', () => {
    const titles = ['Lạc Trôi', 'Nơi Này Có Anh', 'Hãy Trao Cho Anh'];
    const room = new Room({
      code: '1234', setName: 'Test', questions: titles.map((title) => ({ ...questions[0], title })),
      durationMs: 10_000, countdownMs: 3000, onChange: () => {},
    });
    const lan = room.join('Lan', undefined, 's1');
    const minh = room.join('Minh', undefined, 's2');
    if (typeof lan === 'string' || typeof minh === 'string') throw new Error('join');
    const nextQuestion = () => {
      room.next(); room.next(); room.next(); // reveal → leaderboard → next question
      vi.advanceTimersByTime(3000);
    };
    room.next();
    vi.advanceTimersByTime(3000);
    room.guess(lan.id, titles[0]); // the quickest answer of the game
    vi.advanceTimersByTime(500);
    room.guess(minh.id, titles[0]);
    nextQuestion();
    room.guess(lan.id, titles[1]);
    room.guess(minh.id, 'Lạc Trôi');
    vi.advanceTimersByTime(400);
    room.guess(minh.id, 'Bạc Phận');
    nextQuestion();
    room.guess(lan.id, titles[2]);
    expect(room.hostView().awards).toBeNull(); // only once the game is over
    room.finish();
    expect(room.hostView().awards).toEqual({
      fastest: expect.objectContaining({ name: 'Lan', ms: 0, question: 'Lạc Trôi' }),
      streak: expect.objectContaining({ name: 'Lan', streak: 3 }),
      guesser: expect.objectContaining({ name: 'Minh', wrong: 2 }),
      hardest: { title: 'Nơi Này Có Anh', correct: 1, players: 2 },
    });
  });

  it('streak bonus grows from the third answer in a row and stops at the eighth', () => {
    expect([1, 2, 3, 4, 8, 12].map(streakBonus)).toEqual([0, 0, 50, 100, 300, 300]);
  });

  it('shows and hides the join QR code for every host screen', () => {
    const changes = vi.fn();
    const room = new Room({ code: '1234', setName: 'Test', questions, durationMs: 10_000, countdownMs: 3000, onChange: changes });
    expect(room.hostView().joinQr).toBe(false);
    room.showJoinQr(true);
    room.showJoinQr(true); // already shown: nothing to push
    expect(room.hostView().joinQr).toBe(true);
    expect(changes).toHaveBeenCalledTimes(1);
    room.showJoinQr(false);
    expect(room.hostView().joinQr).toBe(false);
  });

  it('lets players react once they have answered, and while the answer and ranking show', () => {
    const room = makeRoom(false);
    const lan = room.join('Lan', undefined, 's1');
    if (typeof lan === 'string') throw new Error(lan);
    expect(room.canReact(lan.id)).toBe(false); // lobby
    room.next();
    vi.advanceTimersByTime(3000);
    expect(room.canReact(lan.id)).toBe(false); // still guessing
    room.guess(lan.id, 'Lạc Trôi');
    expect(room.canReact(lan.id)).toBe(true);
    room.next(); // reveal
    expect(room.canReact(lan.id)).toBe(true);
    expect(room.canReact('nobody')).toBe(false);
  });

  it('plays "together": a team\'s first right answer counts for the whole team', () => {
    const room = new Room({
      code: '1234', setName: 'Test', questions, durationMs: 10_000, countdownMs: 3000,
      teamMode: 'together', teamCount: 2, onChange: () => {},
    });
    const [lan, minh, hoa] = ['Lan', 'Minh', 'Hoa'].map((name, i) => {
      const player = room.join(name, undefined, `s${i}`);
      if (typeof player === 'string') throw new Error(player);
      return player;
    });
    expect([lan, minh, hoa].map((p) => p.team)).toEqual([null, null, null]); // players pick in the lobby
    room.setTeam(lan.id, 0);
    room.setTeam(hoa.id, 0);
    room.next();
    expect(room.phase).toBe('lobby'); // not with a player still teamless...
    room.setTeam(minh.id, 0);
    room.setTeam(minh.id, 1); // (switching is allowed in the lobby)
    room.next();
    expect(room.phase).toBe('question'); // ...but once everyone has one
    room.setTeam(minh.id, 0); // no switching once the game is on
    expect(minh.team).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(room.guess(lan.id, 'Lạc Trôi')).toMatchObject({ status: 'correct', points: 1000 });
    expect(hoa.score).toBe(1000); // credited with Lan's answer
    expect(minh.score).toBe(0);
    expect(room.guess(hoa.id, 'Lạc Trôi')).toEqual({ status: 'already' });
    const hoaPhone = room.playerViews().find((v) => v.socketId === 's2')!.state;
    expect(hoaPhone.round).toMatchObject({ correct: true, points: 1000, byTeam: true });
    expect(hoaPhone.teams).toBeNull(); // held back while the question is open
    expect(room.hostView().teams).toEqual([
      { team: 0, score: 1000, members: 2, delta: 0, roundPoints: 1000 },
      { team: 1, score: 0, members: 1, delta: 0, roundPoints: 0 },
    ]);
    room.finish();
    expect(room.playerViews()[0].state.podium?.map((e) => e.name)).toEqual(['Đội Đỏ', 'Đội Xanh']);
  });

  it('the host can deal everyone into even teams; latecomers fill the smallest team', () => {
    const room = new Room({
      code: '1234', setName: 'Test', questions, durationMs: 10_000, countdownMs: 3000,
      preview: true, bots: 7, teamMode: 'average', teamCount: 3, onChange: () => {},
    });
    const players = () => room.hostView().players;
    expect(players().every((p) => p.team === null)).toBe(true); // preview bots wait to be dealt too
    room.shuffleTeams();
    const sizes = [0, 1, 2].map((team) => players().filter((p) => p.team === team).length).sort();
    expect(sizes).toEqual([2, 2, 3]);
    room.next();
    expect(room.phase).toBe('question');
    const late = room.join('Muộn', undefined, 's9');
    if (typeof late === 'string') throw new Error(late);
    expect(late.team).not.toBeNull();
    expect(players().filter((p) => p.team === late.team).length).toBe(3); // joined a team of two
    room.shuffleTeams(); // lobby only
    expect(late.team).not.toBeNull();
  });

  it('takes any number of teams from 2 up to all the colours', () => {
    const teamsOf = (teamCount: number) =>
      new Room({ code: '1234', setName: 'T', questions, durationMs: 10_000, countdownMs: 3000, teamMode: 'average', teamCount, onChange: () => {} })
        .hostView().teams.length;
    expect([1, 2, 7, 10, 99].map(teamsOf)).toEqual([2, 2, 7, 10, 10]);
  });

  it('tracks how teams move between questions, like players', () => {
    const room = new Room({
      code: '1234', setName: 'Test', questions: threeQuestions, durationMs: 10_000, countdownMs: 3000,
      teamMode: 'average', teamCount: 2, onChange: () => {},
    });
    const [lan, minh] = ['Lan', 'Minh'].map((name, i) => {
      const player = room.join(name, undefined, 's' + i);
      if (typeof player === 'string') throw new Error(player);
      return player;
    });
    room.setTeam(lan.id, 0);
    room.setTeam(minh.id, 1);
    room.next();
    vi.advanceTimersByTime(3000 + 5000);
    room.guess(lan.id, 'Lạc Trôi'); // halfway through: 750, team 0 leads
    room.next(); room.next(); room.next(); // reveal → leaderboard → question 2
    vi.advanceTimersByTime(3000);
    room.guess(minh.id, 'Nơi Này Có Anh'); // at once: 1000, team 1 overtakes
    room.next(); room.next(); // reveal → leaderboard
    expect(room.hostView().teams).toEqual([
      { team: 1, score: 1000, members: 1, delta: 1, roundPoints: 1000 },
      { team: 0, score: 750, members: 1, delta: -1, roundPoints: 0 },
    ]);
  });

  it('has no streaks in team play: no bonus, no fire, no streak title', () => {
    const titles = ['Lạc Trôi', 'Nơi Này Có Anh', 'Hãy Trao Cho Anh'];
    const room = new Room({
      code: '1234', setName: 'Test', questions: titles.map((title) => ({ ...questions[0], title })),
      durationMs: 10_000, countdownMs: 3000, teamMode: 'average', teamCount: 2, onChange: () => {},
    });
    const lan = room.join('Lan', undefined, 's1');
    if (typeof lan === 'string') throw new Error(lan);
    room.setTeam(lan.id, 0);
    room.next();
    for (const [i, title] of titles.entries()) {
      vi.advanceTimersByTime(3000);
      // No +50 on the third answer in a row.
      const points = i === titles.length - 1 ? 3000 : 1000; // the final question scores triple
      expect(room.guess(lan.id, title)).toEqual({ status: 'correct', points, gift: 0, streak: 0, stolenFrom: null });
      expect(room.hostView().correctFeed[0].streak).toBe(0);
      if (i < titles.length - 1) { room.next(); room.next(); room.next(); }
    }
    room.finish();
    expect(room.hostView().awards?.streak).toBeNull();
  });

  it('a room without teams leaves everyone teamless', () => {
    const room = makeRoom(false);
    const lan = room.join('Lan', undefined, 's1');
    if (typeof lan === 'string') throw new Error(lan);
    room.setTeam(lan.id, 0);
    expect(lan.team).toBeNull();
    expect(room.hostView().teams).toEqual([]);
  });

  it('a normal room has no bots', () => {
    expect(makeRoom(false).hostView().players).toHaveLength(0);
  });
});

describe('pickLuck', () => {
  it('picks about 15% of the questions, never the first or last, no duplicates', () => {
    for (let run = 0; run < 50; run++) {
      const { doubleRounds, giftChances } = pickLuck(10);
      expect(doubleRounds).toHaveLength(2);
      expect(new Set(doubleRounds).size).toBe(2);
      expect(doubleRounds).not.toContain(0);
      expect(doubleRounds.every((i) => i >= 1 && i <= 8)).toBe(true); // never the first or the (x3) last
      expect(giftChances).toEqual([0.12, 0.14, 0.16]);
    }
    expect(pickLuck(30).doubleRounds).toHaveLength(5);
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
    expect(players.slice(0, 2).map((p) => p.name)).toEqual(['Bot Luôn Đúng', 'Bot Mít']);
    expect(players[99].name).toBe('Bot 99');
    expect(typeof room.join('Lan', undefined, 's1')).not.toBe('string'); // real players still fit
  });
});
