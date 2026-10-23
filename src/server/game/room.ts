import { randomBytes } from 'node:crypto';
import {
  audioUrl,
  LEADERBOARD_MS,
  OPEN_CLIP_SEC,
  PREVIEW_BOTS,
  type GuessResult,
  type HostState,
  type Phase,
  type PlayerState,
  type RankRow,
  type WrongEntry,
} from '../../shared/types.ts';
import { AVATARS } from '../../shared/emoji.ts';
import { isCorrect } from './match.ts';
import { PausableTimers, type TimerEntry } from './timers.ts';

export interface GameQuestion {
  title: string;
  audio: string;
  youtubeId: string;
  startSec: number;
  endSec: number | null;
}

interface Player {
  id: string;
  token: string;
  name: string;
  avatar: string;
  color: string;
  score: number;
  /** Sum of answer times, breaks ties in the ranking. */
  totalMs: number;
  joinedAt: number;
  prevRank: number;
  lastGuessAt: number;
  socketId: string | null;
  bot: boolean;
  /** points = speed score (doubled on lucky rounds) + gift. */
  answers: Map<number, { points: number; gift: number; ms: number }>;
}

export interface RoomOptions {
  code: string;
  setName: string;
  questions: GameQuestion[];
  durationMs: number;
  countdownMs: number;
  preview?: boolean;
  /** How many bots a preview room starts with (default PREVIEW_BOTS). */
  bots?: number;
  /** Random twists; omitted = none (tests). See pickLuck. */
  luck?: Luck;
  onChange: () => void;
}

export interface Luck {
  /** Question indexes worth double points. */
  doubleRounds: number[];
  /** Chance (0–1) that a correct answer also opens a gift box. */
  giftChance: number;
}

const DOUBLE_SHARE = 0.2;
const GIFT_CHANCE = 0.15;
const GIFT_STEPS = [100, 150, 200, 250, 300];

/** About a fifth of the questions (never the first) score double; 15% of correct answers get a gift. */
export function pickLuck(questionCount: number, random = Math.random): Luck {
  const candidates = Array.from({ length: Math.max(0, questionCount - 1) }, (_, i) => i + 1);
  const count = questionCount >= 3 ? Math.max(1, Math.round(questionCount * DOUBLE_SHARE)) : 0;
  const doubleRounds: number[] = [];
  while (doubleRounds.length < count && candidates.length) {
    doubleRounds.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0]);
  }
  return { doubleRounds: doubleRounds.sort((a, b) => a - b), giftChance: GIFT_CHANCE };
}

/** Room size: ~60 players expected, with headroom for 100-bot load tests plus real players. */
export const MAX_PLAYERS = 150;
const BOT_FRUITS = ['Mít', 'Na', 'Ổi', 'Xoài', 'Bưởi', 'Chôm Chôm', 'Măng Cụt', 'Sầu Riêng'];
const botName = (i: number) => `Bot ${BOT_FRUITS[i] ?? i + 1}`;
const BOT_MISS_RATE = 0.25;
/** Share of answering bots that first try another song of the set (makes "Chơi thử" lively). */
const BOT_WRONG_RATE = 0.4;
/** Wrong guesses kept per round for the big screen (older ones have scrolled off anyway). */
const WRONG_FEED_SIZE = 40;
const WRONG_TEXT_LENGTH = 40;
const MAX_NAME_LENGTH = 20;
const MAX_GUESS_LENGTH = 100;
const GUESS_INTERVAL_MS = 300;
const LATE_GRACE_MS = 300;
/** Just long enough for the last correct answer to pop on the big screen. */
const ALL_CORRECT_DELAY_MS = 400;
/** The big screen reports when the answer clip ends; this covers a clip that never does (load error, blocked autoplay). */
const REVEAL_FALLBACK_EXTRA_MS = 12_000;

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'];

const randomToken = () => randomBytes(12).toString('base64url');

/** 1000 points for an instant answer, sliding down to 500 at the buzzer. */
export function scoreFor(elapsedMs: number, durationMs: number): number {
  const ratio = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  return Math.round(1000 - 500 * ratio);
}

export class Room {
  readonly code: string;
  readonly hostToken = randomToken();
  readonly setName: string;
  readonly durationMs: number;
  readonly preview: boolean;
  phase: Phase = 'lobby';
  qIndex = -1;
  startsAt = 0;
  endsAt = 0;
  advanceAt = 0;
  /** The current round ended because every online player answered correctly. */
  allCorrect = false;
  lastActivity = Date.now();
  private readonly questions: GameQuestion[];
  private readonly countdownMs: number;
  private readonly onChange: () => void;
  private readonly players = new Map<string, Player>();
  private correctOrder: string[] = [];
  /** Anonymous on purpose: the big screen shows what was guessed, not who guessed it. */
  private wrongGuesses: WrongEntry[] = [];
  private wrongCount = 0;
  /** 0 while running; when the host paused (round clocks and timers are frozen). */
  pausedAt = 0;
  private readonly timers = new PausableTimers();
  private readonly luck: Luck;
  private timer: TimerEntry | null = null;
  private botTimers: TimerEntry[] = [];
  private joinCount = 0;

  constructor(options: RoomOptions) {
    this.code = options.code;
    this.setName = options.setName;
    this.questions = options.questions;
    this.durationMs = options.durationMs;
    this.countdownMs = options.countdownMs;
    this.preview = options.preview ?? false;
    this.onChange = options.onChange;
    this.luck = options.luck ?? { doubleRounds: [], giftChance: 0 };
    const bots = this.preview ? Math.min(MAX_PLAYERS - 10, options.bots ?? PREVIEW_BOTS) : 0;
    for (let i = 0; i < bots; i++) this.addPlayer(botName(i), null, true);
  }

  /** Returns the player, or an error message for the joiner. */
  join(rawName: string, token: string | undefined, socketId: string): Player | string {
    const existing = token ? [...this.players.values()].find((p) => p.token === token) : undefined;
    if (existing) {
      existing.socketId = socketId;
      this.changed();
      return existing;
    }
    const name = rawName.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return 'Bạn chưa nhập tên';
    if (this.phase === 'ended') return 'Trò chơi đã kết thúc';
    if (this.players.size >= MAX_PLAYERS) return 'Phòng đã đầy';
    const lower = name.toLocaleLowerCase('vi');
    for (const p of this.players.values()) {
      if (p.name.toLocaleLowerCase('vi') === lower) return 'Tên này có người dùng rồi, chọn tên khác nhé';
    }
    const player = this.addPlayer(name, socketId, false);
    this.changed();
    return player;
  }

  private addPlayer(name: string, socketId: string | null, bot: boolean): Player {
    const n = this.joinCount++;
    const player: Player = {
      id: randomToken(),
      token: randomToken(),
      name,
      avatar: AVATARS[n % AVATARS.length],
      color: COLORS[n % COLORS.length],
      score: 0,
      totalMs: 0,
      joinedAt: Date.now(),
      prevRank: this.players.size + 1,
      lastGuessAt: 0,
      socketId,
      bot,
      answers: new Map(),
    };
    this.players.set(player.id, player);
    return player;
  }

  leave(playerId: string, socketId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.socketId !== socketId) return;
    player.socketId = null;
    this.revealIfEveryoneCorrect();
    this.changed();
  }

  /** Removes the player and returns their socket id, if connected. */
  kick(playerId: string): string | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    this.players.delete(playerId);
    this.correctOrder = this.correctOrder.filter((id) => id !== playerId);
    this.revealIfEveryoneCorrect();
    this.changed();
    return player.socketId;
  }

  /** Host "next"/"skip" button: moves one step along lobby → question → reveal → leaderboard → … → ended. */
  next(): void {
    this.resume();
    if (this.phase === 'lobby') return this.startQuestion(0);
    if (this.phase === 'question') return this.reveal();
    if (this.phase === 'reveal') return this.showLeaderboard();
    if (this.phase === 'leaderboard') return this.advance();
  }

  reveal(): void {
    if (this.phase !== 'question') return;
    this.clearTimer();
    this.clearBotTimers();
    this.phase = 'reveal';
    const { startSec, endSec } = this.questions[this.qIndex];
    const clipMs = ((endSec ?? startSec + OPEN_CLIP_SEC) - startSec) * 1000;
    this.schedule(clipMs + REVEAL_FALLBACK_EXTRA_MS, () => this.showLeaderboard());
    this.changed();
  }

  /** The big screen finished the answer clip. Ignored if it is about an earlier round. */
  clipEnded(qIndex: number): void {
    if (this.phase === 'reveal' && qIndex === this.qIndex && !this.pausedAt) this.showLeaderboard();
  }

  /** Freezes the round: clocks, timers, bots and guesses. Only while a round is running. */
  pause(): void {
    if (this.pausedAt || !['question', 'reveal', 'leaderboard'].includes(this.phase)) return;
    this.pausedAt = Date.now();
    this.timers.pause();
    this.changed();
  }

  resume(): void {
    if (!this.pausedAt) return;
    const pausedFor = Date.now() - this.pausedAt;
    this.pausedAt = 0;
    // Deadlines move back by the pause, so answer times (and points) ignore it.
    this.startsAt += pausedFor;
    this.endsAt += pausedFor;
    if (this.advanceAt) this.advanceAt += pausedFor;
    this.timers.resume(pausedFor);
    this.changed();
  }

  finish(): void {
    this.resume();
    if (this.phase === 'ended') return;
    this.clearTimer();
    this.clearBotTimers();
    this.phase = 'ended';
    this.advanceAt = 0;
    this.changed();
  }

  private showLeaderboard(): void {
    if (this.phase !== 'reveal') return;
    this.phase = 'leaderboard';
    this.advanceAt = Date.now() + LEADERBOARD_MS;
    this.schedule(LEADERBOARD_MS, () => this.advance());
    this.changed();
  }

  private advance(): void {
    if (this.qIndex + 1 >= this.questions.length) return this.finish();
    this.startQuestion(this.qIndex + 1);
  }

  guess(playerId: string, text: string, now = Date.now()): GuessResult {
    const player = this.players.get(playerId);
    if (player && this.phase === 'question' && this.pausedAt) return { status: 'paused' };
    if (!player || this.phase !== 'question' || now < this.startsAt || now > this.endsAt + LATE_GRACE_MS) {
      return { status: 'closed' };
    }
    if (player.answers.has(this.qIndex)) return { status: 'already' };
    if (now - player.lastGuessAt < GUESS_INTERVAL_MS) return { status: 'slow' };
    player.lastGuessAt = now;
    this.lastActivity = now;
    if (!isCorrect(text.slice(0, MAX_GUESS_LENGTH), this.questions[this.qIndex].title)) {
      this.recordWrong(text);
      return { status: 'wrong' };
    }

    const elapsed = Math.min(Math.max(now - this.startsAt, 0), this.durationMs);
    const speed = scoreFor(elapsed, this.durationMs) * (this.isDouble() ? 2 : 1);
    const gift = Math.random() < this.luck.giftChance ? GIFT_STEPS[Math.floor(Math.random() * GIFT_STEPS.length)] : 0;
    const points = speed + gift;
    player.answers.set(this.qIndex, { points, gift, ms: elapsed });
    player.score += points;
    player.totalMs += elapsed;
    this.correctOrder.push(player.id);
    this.revealIfEveryoneCorrect();
    this.changed();
    return { status: 'correct', points, gift };
  }

  dispose(): void {
    this.clearTimer();
    this.clearBotTimers();
  }

  hostView(): HostState {
    const question = this.questions[this.qIndex];
    const inRound = this.phase === 'question' || this.phase === 'reveal';
    const upcoming = this.phase === 'ended' ? undefined : this.questions[this.phase === 'lobby' ? 0 : this.qIndex + 1];
    const showRanking = this.phase === 'leaderboard' || this.phase === 'ended';
    return {
      ...this.baseView(),
      setName: this.setName,
      preview: this.preview,
      durationMs: this.durationMs,
      advanceAt: this.advanceAt,
      players: [...this.players.values()].map((p) => ({
        ...identity(p),
        score: p.score,
        connected: isOnline(p),
        correct: p.answers.has(this.qIndex),
        bot: p.bot,
      })),
      audioUrl: inRound && question ? audioUrl(question.audio) : null,
      nextAudioUrl: upcoming ? audioUrl(upcoming.audio) : null,
      answer: this.answerVisible() ? question.title : null,
      clip:
        inRound && question
          ? { youtubeId: question.youtubeId, startSec: question.startSec, endSec: question.endSec }
          : null,
      wrongFeed: this.wrongGuesses,
      correctFeed: this.correctOrder.flatMap((id) => {
        const p = this.players.get(id);
        const answer = p?.answers.get(this.qIndex);
        return p && answer ? [{ ...identity(p), points: answer.points, gift: answer.gift }] : [];
      }),
      leaderboard: showRanking ? this.ranking().slice(0, 10).map((p, i) => this.rankRow(p, i + 1)) : [],
    };
  }

  /** One personalised state per connected player; the ranking is computed once. */
  playerViews(): { socketId: string; state: PlayerState }[] {
    const ranked = this.ranking();
    const base = this.baseView();
    const answer = this.answerVisible() ? this.questions[this.qIndex].title : null;
    const podium =
      this.phase === 'ended'
        ? ranked.slice(0, 3).map((p) => ({ name: p.name, avatar: p.avatar, color: p.color, score: p.score }))
        : null;
    return ranked.flatMap((p, i) =>
      p.socketId
        ? [
            {
              socketId: p.socketId,
              state: {
                ...base,
                playerCount: this.players.size,
                me: { ...identity(p), score: p.score, rank: i + 1, delta: p.prevRank - (i + 1) },
                round: {
                  correct: p.answers.has(this.qIndex),
                  points: p.answers.get(this.qIndex)?.points ?? 0,
                  gift: p.answers.get(this.qIndex)?.gift ?? 0,
                },
                answer,
                podium,
              },
            },
          ]
        : [],
    );
  }

  private baseView() {
    return {
      code: this.code,
      phase: this.phase,
      qIndex: this.qIndex,
      qTotal: this.questions.length,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
      allCorrect: this.allCorrect,
      double: this.isDouble(),
      pausedAt: this.pausedAt,
    };
  }

  /** Only revealed once the question starts (countdown), so nobody knows in advance. */
  private isDouble(): boolean {
    return this.phase !== 'lobby' && this.luck.doubleRounds.includes(this.qIndex);
  }

  private answerVisible(): boolean {
    return (this.phase === 'reveal' || this.phase === 'leaderboard') && Boolean(this.questions[this.qIndex]);
  }

  private startQuestion(index: number): void {
    this.ranking().forEach((p, i) => (p.prevRank = i + 1));
    this.qIndex = index;
    this.phase = 'question';
    this.advanceAt = 0;
    this.allCorrect = false;
    this.correctOrder = [];
    this.wrongGuesses = [];
    const now = Date.now();
    this.startsAt = now + this.countdownMs;
    this.endsAt = this.startsAt + this.durationMs;
    this.schedule(this.endsAt + LATE_GRACE_MS - now, () => this.reveal());
    if (this.preview) this.scheduleBots();
    this.changed();
  }

  private recordWrong(text: string): void {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, WRONG_TEXT_LENGTH);
    if (!clean) return;
    this.wrongGuesses.push({ key: String(++this.wrongCount), text: clean });
    if (this.wrongGuesses.length > WRONG_FEED_SIZE) this.wrongGuesses.shift();
    this.changed();
  }

  /** Bots answer correctly at a random moment (some try another song first), or not at all. */
  private scheduleBots(): void {
    this.clearBotTimers();
    const title = this.questions[this.qIndex].title;
    const otherTitles = this.questions.map((q) => q.title).filter((t) => t !== title);
    for (const p of this.players.values()) {
      if (!p.bot || Math.random() < BOT_MISS_RATE) continue;
      const delay = this.countdownMs + this.durationMs * (0.1 + Math.random() * 0.7);
      if (otherTitles.length && Math.random() < BOT_WRONG_RATE) {
        const wrong = otherTitles[Math.floor(Math.random() * otherTitles.length)];
        const wrongAt = Math.max(this.countdownMs + 200, delay - 1500);
        this.botTimers.push(this.timers.set(wrongAt, () => this.guess(p.id, wrong)));
      }
      this.botTimers.push(this.timers.set(delay, () => this.guess(p.id, title)));
    }
  }

  private clearBotTimers(): void {
    this.botTimers.forEach((entry) => this.timers.clear(entry));
    this.botTimers = [];
  }

  private revealIfEveryoneCorrect(): void {
    if (this.phase !== 'question') return;
    let online = 0;
    for (const p of this.players.values()) {
      if (!isOnline(p)) continue;
      online++;
      if (!p.answers.has(this.qIndex)) return;
    }
    if (online === 0) return;
    this.allCorrect = true;
    this.schedule(ALL_CORRECT_DELAY_MS, () => this.reveal());
  }

  private ranking(): Player[] {
    return [...this.players.values()].sort(
      (a, b) => b.score - a.score || a.totalMs - b.totalMs || a.joinedAt - b.joinedAt,
    );
  }

  private rankRow(p: Player, rank: number): RankRow {
    return {
      ...identity(p),
      score: p.score,
      rank,
      delta: p.prevRank - rank,
      roundPoints: p.answers.get(this.qIndex)?.points ?? 0,
    };
  }

  private schedule(ms: number, fn: () => void): void {
    this.clearTimer();
    this.timer = this.timers.set(ms, fn);
  }

  private clearTimer(): void {
    this.timers.clear(this.timer);
    this.timer = null;
  }

  private changed(): void {
    this.lastActivity = Date.now();
    this.onChange();
  }
}

const isOnline = (p: Player) => p.bot || p.socketId !== null;
const identity = (p: Player) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color });
