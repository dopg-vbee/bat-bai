import { randomBytes } from 'node:crypto';
import {
  audioUrl,
  type GuessResult,
  type HostState,
  type Phase,
  type PlayerState,
  type RankRow,
} from '../../shared/types.ts';
import { isCorrect } from './match.ts';

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
  answers: Map<number, { points: number; ms: number }>;
}

export interface RoomOptions {
  code: string;
  setName: string;
  questions: GameQuestion[];
  durationMs: number;
  countdownMs: number;
  preview?: boolean;
  onChange: () => void;
}

export const MAX_PLAYERS = 100;
const BOT_NAMES = ['Mít', 'Na', 'Ổi', 'Xoài', 'Bưởi', 'Chôm Chôm', 'Măng Cụt', 'Sầu Riêng'].map((n) => `Bot ${n}`);
const BOT_MISS_RATE = 0.25;
const MAX_NAME_LENGTH = 20;
const MAX_GUESS_LENGTH = 100;
const GUESS_INTERVAL_MS = 300;
const LATE_GRACE_MS = 300;
const ALL_CORRECT_DELAY_MS = 1200;

const AVATARS = [...'🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐤🦆🦉🐺🐴🦄🐝🦋🐞🐢🐙🦀🐬🐳🦈🦓🦒🦔🐲🌵🍄🌻🍉🍕🍩🎃👻👽🤖🦩🦜🐌🦖🐿️'.matchAll(/\p{Extended_Pictographic}️?/gu)].map((m) => m[0]);
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
  lastActivity = Date.now();
  private readonly questions: GameQuestion[];
  private readonly countdownMs: number;
  private readonly onChange: () => void;
  private readonly players = new Map<string, Player>();
  private correctOrder: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private botTimers: ReturnType<typeof setTimeout>[] = [];
  private joinCount = 0;

  constructor(options: RoomOptions) {
    this.code = options.code;
    this.setName = options.setName;
    this.questions = options.questions;
    this.durationMs = options.durationMs;
    this.countdownMs = options.countdownMs;
    this.preview = options.preview ?? false;
    this.onChange = options.onChange;
    if (this.preview) for (const name of BOT_NAMES) this.addPlayer(name, null, true);
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

  /** Host "next" button: lobby → Q1, question → reveal, reveal → next question or final results. */
  next(): void {
    if (this.phase === 'question') return this.reveal();
    if (this.phase === 'ended') return;
    if (this.qIndex + 1 >= this.questions.length) return this.finish();
    this.startQuestion(this.qIndex + 1);
  }

  reveal(): void {
    if (this.phase !== 'question') return;
    this.clearTimer();
    this.clearBotTimers();
    this.phase = 'reveal';
    this.changed();
  }

  finish(): void {
    if (this.phase === 'ended') return;
    this.clearTimer();
    this.clearBotTimers();
    this.phase = 'ended';
    this.changed();
  }

  guess(playerId: string, text: string, now = Date.now()): GuessResult {
    const player = this.players.get(playerId);
    if (!player || this.phase !== 'question' || now < this.startsAt || now > this.endsAt + LATE_GRACE_MS) {
      return { status: 'closed' };
    }
    if (player.answers.has(this.qIndex)) return { status: 'already' };
    if (now - player.lastGuessAt < GUESS_INTERVAL_MS) return { status: 'slow' };
    player.lastGuessAt = now;
    this.lastActivity = now;
    if (!isCorrect(text.slice(0, MAX_GUESS_LENGTH), this.questions[this.qIndex].title)) return { status: 'wrong' };

    const elapsed = Math.min(Math.max(now - this.startsAt, 0), this.durationMs);
    const points = scoreFor(elapsed, this.durationMs);
    player.answers.set(this.qIndex, { points, ms: elapsed });
    player.score += points;
    player.totalMs += elapsed;
    this.correctOrder.push(player.id);
    this.revealIfEveryoneCorrect();
    this.changed();
    return { status: 'correct', points };
  }

  dispose(): void {
    this.clearTimer();
    this.clearBotTimers();
  }

  hostView(): HostState {
    const question = this.questions[this.qIndex];
    const inRound = this.phase === 'question' || this.phase === 'reveal';
    const upcoming = this.phase === 'ended' ? undefined : this.questions[this.phase === 'lobby' ? 0 : this.qIndex + 1];
    const showRanking = this.phase === 'reveal' || this.phase === 'ended';
    return {
      ...this.baseView(),
      setName: this.setName,
      preview: this.preview,
      durationMs: this.durationMs,
      players: [...this.players.values()].map((p) => ({
        ...identity(p),
        score: p.score,
        connected: isOnline(p),
        correct: p.answers.has(this.qIndex),
      })),
      audioUrl: inRound && question ? audioUrl(question.audio) : null,
      nextAudioUrl: upcoming ? audioUrl(upcoming.audio) : null,
      answer: this.phase === 'reveal' && question ? question.title : null,
      clip:
        inRound && question
          ? { youtubeId: question.youtubeId, startSec: question.startSec, endSec: question.endSec }
          : null,
      correctFeed: this.correctOrder.flatMap((id) => {
        const p = this.players.get(id);
        return p ? [{ ...identity(p), points: p.answers.get(this.qIndex)?.points ?? 0 }] : [];
      }),
      leaderboard: showRanking ? this.ranking().slice(0, 10).map((p, i) => this.rankRow(p, i + 1)) : [],
    };
  }

  /** One personalised state per connected player; the ranking is computed once. */
  playerViews(): { socketId: string; state: PlayerState }[] {
    const ranked = this.ranking();
    const base = this.baseView();
    const answer = this.phase === 'reveal' ? this.questions[this.qIndex]?.title ?? null : null;
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
                round: { correct: p.answers.has(this.qIndex), points: p.answers.get(this.qIndex)?.points ?? 0 },
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
    };
  }

  private startQuestion(index: number): void {
    this.ranking().forEach((p, i) => (p.prevRank = i + 1));
    this.qIndex = index;
    this.phase = 'question';
    this.correctOrder = [];
    const now = Date.now();
    this.startsAt = now + this.countdownMs;
    this.endsAt = this.startsAt + this.durationMs;
    this.schedule(this.endsAt + LATE_GRACE_MS - now, () => this.reveal());
    if (this.preview) this.scheduleBots();
    this.changed();
  }

  /** Bots answer correctly at a random moment, or sometimes not at all. */
  private scheduleBots(): void {
    this.clearBotTimers();
    const title = this.questions[this.qIndex].title;
    for (const p of this.players.values()) {
      if (!p.bot || Math.random() < BOT_MISS_RATE) continue;
      const delay = this.countdownMs + this.durationMs * (0.1 + Math.random() * 0.7);
      this.botTimers.push(setTimeout(() => this.guess(p.id, title), delay));
    }
  }

  private clearBotTimers(): void {
    this.botTimers.forEach(clearTimeout);
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
    if (online > 0) this.schedule(ALL_CORRECT_DELAY_MS, () => this.reveal());
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
    this.timer = setTimeout(fn, Math.max(0, ms));
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private changed(): void {
    this.lastActivity = Date.now();
    this.onChange();
  }
}

const isOnline = (p: Player) => p.bot || p.socketId !== null;
const identity = (p: Player) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color });
