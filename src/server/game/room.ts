import { randomBytes } from 'node:crypto';
import {
  audioUrl,
  LEADERBOARD_MS,
  MIN_TEAMS,
  OPEN_CLIP_SEC,
  PREVIEW_BOTS,
  streakBonus,
  type GuessResult,
  type HostState,
  type Phase,
  type PlayerState,
  type RankRow,
  type TeamMode,
  type TeamStanding,
  type WrongEntry,
  TEAMS,
} from '../../shared/types.ts';
import { AVATARS } from '../../shared/emoji.ts';
import { computeAwards } from './awards.ts';
import { rollGift, rollSteal, scoreFor, type Luck } from './luck.ts';
import { checkGuess } from './match.ts';
import { identity, isOnline, streakAt, type Player } from './player.ts';
import { dealTeams, smallestTeam, teamStandings } from './teams.ts';
import { PausableTimers, type TimerEntry } from './timers.ts';

export interface GameQuestion {
  title: string;
  audio: string;
  youtubeId: string;
  startSec: number;
  endSec: number | null;
}

interface RoomOptions {
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
  teamMode?: TeamMode;
  teamCount?: number;
  onChange: () => void;
}

/** Room size: ~60 players expected, with headroom for 100-bot load tests plus real players. */
const MAX_PLAYERS = 150;
const BOT_FRUITS = ['Mít', 'Na', 'Ổi', 'Xoài', 'Bưởi', 'Chôm Chôm', 'Măng Cụt', 'Sầu Riêng'];
const botName = (i: number) => `Bot ${BOT_FRUITS[i] ?? i + 1}`;
/** The first preview bot never misses, so a streak (and its fire) can be watched growing. */
const SURE_BOT_NAME = 'Bot Luôn Đúng';
const BOT_MISS_RATE = 0.25;
/** Share of answering bots that first try another song of the set (makes "Chơi thử" lively). */
const BOT_WRONG_RATE = 0.4;
/** Rows on the between-rounds leaderboard; the final screen lists everyone. */
const LEADERBOARD_ROWS = 10;
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

export class Room {
  readonly code: string;
  readonly hostToken = randomToken();
  readonly setName: string;
  readonly durationMs: number;
  readonly preview: boolean;
  readonly teamMode: TeamMode;
  /** 0 outside team play. */
  readonly teamCount: number;
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
  joinQr = false;
  private readonly timers = new PausableTimers();
  private readonly luck: Luck;
  private timer: TimerEntry | null = null;
  private botTimers: TimerEntry[] = [];
  private sureBotId: string | null = null;
  /** Each team's place and score when the question started, for the leaderboard's movement. */
  private teamsAtStart = new Map<number, { rank: number; score: number }>();
  /** Each player's third of the standings when the question started (0 = top; ties share one). */
  private giftTiers = new Map<string, number>();
  private joinCount = 0;

  constructor(options: RoomOptions) {
    this.code = options.code;
    this.setName = options.setName;
    this.questions = options.questions;
    this.durationMs = options.durationMs;
    this.countdownMs = options.countdownMs;
    this.preview = options.preview ?? false;
    this.onChange = options.onChange;
    this.luck = options.luck ?? { doubleRounds: [], giftChances: [0, 0, 0], stealShare: 0 };
    this.teamMode = options.teamMode ?? 'off';
    const teamCount = Math.round(options.teamCount ?? MIN_TEAMS);
    this.teamCount = this.teamMode === 'off' ? 0 : Math.min(Math.max(teamCount, MIN_TEAMS), TEAMS.length);
    const bots = this.preview ? Math.min(MAX_PLAYERS - 10, options.bots ?? PREVIEW_BOTS) : 0;
    for (let i = 0; i < bots; i++) {
      const bot = this.addPlayer(i === 0 ? SURE_BOT_NAME : botName(i - 1), null, true);
      if (i === 0) this.sureBotId = bot.id;
    }
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
      // In the lobby players pick a team themselves; latecomers can't, so they fill the smallest one.
      team: this.teamCount && this.phase !== 'lobby' ? smallestTeam([...this.players.values()], this.teamCount) : null,
      wrongTotal: 0,
      answers: new Map(),
      robbed: new Map(),
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
    if (this.phase === 'lobby') return this.everyoneInATeam() ? this.startQuestion(0) : undefined;
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

  /** Reactions come from those who are done: answered this question, or watching the answer or ranking. */
  canReact(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    if (this.phase === 'reveal' || this.phase === 'leaderboard') return true;
    return this.phase === 'question' && player.answers.has(this.qIndex);
  }

  /** A team game only starts once every player has picked (or been dealt) a team. */
  everyoneInATeam(): boolean {
    return !this.teamCount || [...this.players.values()].every((p) => p.team !== null);
  }

  /** Host button: deals everyone into teams at random, evenly. Lobby only. */
  shuffleTeams(): void {
    if (this.phase !== 'lobby' || !this.teamCount) return;
    dealTeams([...this.players.values()], this.teamCount);
    this.changed();
  }

  /** A player picks another team; only before the game starts. */
  setTeam(playerId: string, team: number): void {
    const player = this.players.get(playerId);
    if (!player || this.phase !== 'lobby' || !Number.isInteger(team) || team < 0 || team >= this.teamCount) return;
    player.team = team;
    this.changed();
  }

  /** Shows or hides the join QR code over the game for latecomers. */
  showJoinQr(shown: boolean): void {
    if (this.joinQr === shown) return;
    this.joinQr = shown;
    this.changed();
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
    const match = checkGuess(text.slice(0, MAX_GUESS_LENGTH), this.questions[this.qIndex].title);
    if (match !== 'correct') {
      player.wrongTotal++;
      this.recordWrong(text);
      return { status: match };
    }

    const elapsed = Math.min(Math.max(now - this.startsAt, 0), this.durationMs);
    const speed = scoreFor(elapsed, this.durationMs) * (this.isDouble() ? 2 : 1);
    // Joined during this question: counts as last.
    let gift = rollGift(this.luck, this.giftTiers.get(player.id) ?? 2);
    const victim = gift ? this.stealVictim(player) : undefined;
    const steal = victim ? Math.min(rollSteal(this.luck), victim.score) : 0;
    if (victim && steal) {
      gift = steal;
      victim.score -= steal;
      victim.robbed.set(this.qIndex, (victim.robbed.get(this.qIndex) ?? 0) + steal);
    }
    const stolenFrom = steal ? victim : undefined;
    const streak = this.teamMode === 'off' ? streakAt(player, this.qIndex - 1) + 1 : 0;
    const points = speed + gift + streakBonus(streak);
    player.answers.set(this.qIndex, { points, gift, ms: elapsed, stolenFrom });
    player.score += points;
    player.totalMs += elapsed;
    this.correctOrder.push(player.id);
    if (this.teamMode === 'together') {
      // The whole team is right with this answer: everyone in it gets the same points.
      for (const mate of this.players.values()) {
        if (mate.team !== player.team || mate.answers.has(this.qIndex)) continue;
        mate.answers.set(this.qIndex, { points, gift, ms: elapsed, byTeam: true });
        mate.score += points;
        mate.totalMs += elapsed;
      }
    }
    this.revealIfEveryoneCorrect();
    this.changed();
    return { status: 'correct', points, gift, streak, stolenFrom: stolenFrom?.name ?? null };
  }

  /**
   * Who a gift box would steal from: the leader at the start of the question (solo play, not the finder),
   * at most once a question.
   */
  private stealVictim(finder: Player): Player | undefined {
    if (this.teamMode !== 'off') return undefined;
    const leader = [...this.players.values()].find((p) => p.prevRank === 1);
    return leader && leader !== finder && leader.score > 0 && !leader.robbed.has(this.qIndex) ? leader : undefined;
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
      joinQr: this.joinQr,
      teamMode: this.teamMode,
      teams: this.teams(),
      players: [...this.players.values()].map((p) => ({
        ...identity(p),
        score: p.score,
        connected: isOnline(p),
        correct: p.answers.has(this.qIndex),
        bot: p.bot,
        team: p.team,
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
        return p && answer
          ? [
              {
                ...identity(p),
                team: p.team,
                points: answer.points,
                gift: answer.gift,
                stolenFrom: answer.stolenFrom?.name ?? null,
                streak: this.streakAt(p, this.qIndex),
              },
            ]
          : [];
      }),
      leaderboard: showRanking
        ? this.ranking()
            .slice(0, this.phase === 'ended' ? undefined : LEADERBOARD_ROWS)
            .map((p, i) => this.rankRow(p, i + 1))
        : [],
      awards:
        this.phase === 'ended'
          ? computeAwards([...this.players.values()], this.questions.map((q) => q.title), this.qIndex, {
              streaks: this.teamMode === 'off',
            })
          : null,
    };
  }

  /** One personalised state per connected player; the ranking is computed once. */
  playerViews(): { socketId: string; state: PlayerState }[] {
    const ranked = this.ranking();
    const base = this.baseView();
    const answer = this.answerVisible() ? this.questions[this.qIndex].title : null;
    // Held back while a question is open (see PlayerState.teams).
    const teams = this.teamCount && this.phase !== 'question' ? this.teams() : null;
    const podium = this.phase === 'ended' ? this.podium(ranked, teams) : null;
    // Phones only show the rank after the reveal; holding it during the question keeps everyone
    // else's state unchanged when one player scores, so it isn't re-sent to all of them.
    const holdRank = this.phase === 'question';
    return ranked.flatMap((p, i) =>
      p.socketId
        ? [
            {
              socketId: p.socketId,
              state: {
                ...base,
                playerCount: this.players.size,
                me: {
                  ...identity(p),
                  score: p.score,
                  rank: holdRank ? p.prevRank : i + 1,
                  delta: holdRank ? 0 : p.prevRank - (i + 1),
                  team: p.team,
                },
                round: {
                  correct: p.answers.has(this.qIndex),
                  points: p.answers.get(this.qIndex)?.points ?? 0,
                  gift: p.answers.get(this.qIndex)?.gift ?? 0,
                  stolenFrom: p.answers.get(this.qIndex)?.stolenFrom?.name ?? null,
                  robbed: p.robbed.get(this.qIndex) ?? 0,
                  // While the question is open an unanswered one hasn't broken the streak yet.
                  streak: this.streakAt(p, holdRank && !p.answers.has(this.qIndex) ? this.qIndex - 1 : this.qIndex),
                  byTeam: Boolean(p.answers.get(this.qIndex)?.byTeam),
                },
                teamMode: this.teamMode,
                teams,
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
    const ranked = this.ranking();
    ranked.forEach((p, i) => (p.prevRank = i + 1));
    this.giftTiers = new Map(
      ranked.map((p) => [p.id, Math.floor((ranked.filter((q) => q.score > p.score).length * 3) / ranked.length)]),
    );
    this.teamsAtStart = new Map(this.teams().map((t, i) => [t.team, { rank: i + 1, score: t.score }]));
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

  /**
   * Bots answer correctly at a random moment (some try another song first), or not at all;
   * the sure bot always answers, right the first time.
   */
  private scheduleBots(): void {
    this.clearBotTimers();
    const title = this.questions[this.qIndex].title;
    const otherTitles = this.questions.map((q) => q.title).filter((t) => t !== title);
    for (const p of this.players.values()) {
      const sure = p.id === this.sureBotId;
      if (!p.bot || (!sure && Math.random() < BOT_MISS_RATE)) continue;
      const delay = this.countdownMs + this.durationMs * (0.1 + Math.random() * 0.7);
      if (!sure && otherTitles.length && Math.random() < BOT_WRONG_RATE) {
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

  /** Streaks (bonus, fire, the streak title) are a solo thing: in team play they stay at 0. */
  private streakAt(p: Player, index: number): number {
    return this.teamMode === 'off' ? streakAt(p, index) : 0;
  }

  private teams(): TeamStanding[] {
    if (!this.teamCount) return [];
    return teamStandings([...this.players.values()], this.teamCount).map((t, i) => {
      const start = this.teamsAtStart.get(t.team);
      return { ...t, delta: start ? start.rank - (i + 1) : 0, roundPoints: start ? t.score - start.score : 0 };
    });
  }

  /** Top three players, or top three teams in "together" mode, where teammates all score alike. */
  private podium(ranked: Player[], teams: TeamStanding[] | null) {
    if (this.teamMode === 'together' && teams) {
      return teams.slice(0, 3).map(({ team, score }) => {
        const { name, emoji, color } = TEAMS[team];
        return { name: `Đội ${name}`, avatar: emoji, color, score };
      });
    }
    return ranked.slice(0, 3).map((p) => ({ name: p.name, avatar: p.avatar, color: p.color, score: p.score }));
  }

  private rankRow(p: Player, rank: number): RankRow {
    return {
      ...identity(p),
      score: p.score,
      rank,
      delta: p.prevRank - rank,
      roundPoints: (p.answers.get(this.qIndex)?.points ?? 0) - (p.robbed.get(this.qIndex) ?? 0),
      streak: this.streakAt(p, this.qIndex),
      team: p.team,
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
