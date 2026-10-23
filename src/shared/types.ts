/** A round: question → reveal (answer video) → leaderboard (a few seconds) → next question. */
export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

interface PlayerIdentity {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface PlayerSummary extends PlayerIdentity {
  score: number;
  connected: boolean;
  correct: boolean;
  /** Played by the server in a "Chơi thử" room. */
  bot: boolean;
}

export interface CorrectEntry extends PlayerIdentity {
  /** Everything earned this round, gift included. */
  points: number;
  /** Bonus from a lucky gift box, 0 if none. */
  gift: number;
  /** Correct answers in a row, this one included. */
  streak: number;
}

/** A wrong guess, shown anonymously on the big screen. `key` is unique within the round. */
export interface WrongEntry {
  key: string;
  text: string;
}

export interface RankRow extends PlayerIdentity {
  score: number;
  rank: number;
  /** Positive = moved up since the start of the round. */
  delta: number;
  roundPoints: number;
  /** Correct answers in a row up to this round; 0 once one is missed. */
  streak: number;
}

export interface ClipInfo {
  youtubeId: string;
  startSec: number;
  /** null = keep playing until the host moves on. */
  endSec: number | null;
}

export interface HostState {
  code: string;
  setName: string;
  /** Trial room: bots play along so the host can see the real flow. */
  preview: boolean;
  phase: Phase;
  qIndex: number;
  qTotal: number;
  durationMs: number;
  startsAt: number;
  endsAt: number;
  /** When the leaderboard moves on by itself (0 when nothing is scheduled). */
  advanceAt: number;
  /** The round ended early because everyone answered correctly. */
  allCorrect: boolean;
  /** Lucky round: points count double. */
  double: boolean;
  /** 0 while running; otherwise when the host paused. Clocks show this instant until resumed. */
  pausedAt: number;
  players: PlayerSummary[];
  audioUrl: string | null;
  nextAudioUrl: string | null;
  /** Only sent from the reveal on, so the big screen never spoils the answer. */
  answer: string | null;
  /** Sent from the start of the round so the host can pre-buffer the video in HD (kept hidden). */
  clip: ClipInfo | null;
  correctFeed: CorrectEntry[];
  /** Latest wrong guesses of the current round, oldest first. */
  wrongFeed: WrongEntry[];
  /** Filled during the leaderboard phase and at the end. */
  leaderboard: RankRow[];
  /** Only at the end: fun titles shown after the podium. */
  awards: GameAwards | null;
}

/** Each title is null when nobody earned it (e.g. no wrong guesses at all). */
export interface GameAwards {
  /** Quickest correct answer of the game. */
  fastest: (PlayerIdentity & { ms: number; question: string }) | null;
  /** Longest run of correct answers, from STREAK_MIN. */
  streak: (PlayerIdentity & { streak: number }) | null;
  /** Most wrong guesses (a count only: the guesses themselves stay anonymous). */
  guesser: (PlayerIdentity & { wrong: number }) | null;
  /** The question the fewest players got right. */
  hardest: { title: string; correct: number; players: number } | null;
}

export interface PodiumEntry {
  name: string;
  avatar: string;
  color: string;
  score: number;
}

export interface PlayerState {
  code: string;
  phase: Phase;
  qIndex: number;
  qTotal: number;
  startsAt: number;
  endsAt: number;
  allCorrect: boolean;
  double: boolean;
  pausedAt: number;
  playerCount: number;
  me: PlayerIdentity & { score: number; rank: number; delta: number };
  /** streak: correct answers in a row, still counting the previous ones while this question is open. */
  round: { correct: boolean; points: number; gift: number; streak: number };
  answer: string | null;
  podium: PodiumEntry[] | null;
}

type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export type GuessResult =
  | { status: 'correct'; points: number; gift: number; streak: number }
  /** close: wrong, but nearly the name (a typo or two too many, a word missing). */
  | { status: 'wrong' | 'close' | 'closed' | 'slow' | 'already' | 'paused' };

export interface CreateRoomInput {
  password: string;
  setId: string;
  durationSec: number;
  shuffle: boolean;
  preview?: boolean;
  /** Bots in a preview room (default PREVIEW_BOTS). */
  bots?: number;
  /** Preview a single question instead of the whole set. */
  questionId?: string;
}

interface JoinInput {
  code: string;
  name: string;
  token?: string;
}

export interface ServerToClientEvents {
  hostState: (state: HostState) => void;
  playerState: (state: PlayerState) => void;
  kicked: () => void;
}

export interface ClientToServerEvents {
  time: (cb: (serverNow: number) => void) => void;
  'host:create': (input: CreateRoomInput, cb: (res: Ack<{ code: string; hostToken: string }>) => void) => void;
  'host:join': (input: { code: string; hostToken: string }, cb: (res: Ack) => void) => void;
  'host:next': () => void;
  'host:reveal': () => void;
  'host:end': () => void;
  /** The host screen was closed (navigated away): stop sending it this room's state. */
  'host:leave': () => void;
  'host:pause': () => void;
  'host:resume': () => void;
  /** The answer video finished playing on the big screen. */
  'host:clipEnded': (qIndex: number) => void;
  'host:kick': (playerId: string) => void;
  'player:join': (input: JoinInput, cb: (res: Ack<{ playerId: string; token: string }>) => void) => void;
  'player:guess': (text: string, cb: (res: GuessResult) => void) => void;
  'player:leave': () => void;
}

export interface QuestionDto {
  id: string;
  title: string;
  audioUrl: string;
  youtubeUrl: string;
  youtubeId: string;
  startSec: number;
  endSec: number | null;
}

export interface QuestionSetDto {
  id: string;
  name: string;
  updatedAt: string;
  questions: QuestionDto[];
}

export const DURATION_OPTIONS = [15, 20, 30, 45, 60];
export const DEFAULT_DURATION_SEC = 20;
/** Bots that join a "Chơi thử" room. */
/** Default number of bots in a "Chơi thử" room; the admin can pick up to the last option. */
export const PREVIEW_BOTS = 4;
export const PREVIEW_BOT_OPTIONS = [4, 20, 50, 100];
/** Answer clips without an end mark play this long. */
export const OPEN_CLIP_SEC = 25;
export const LEADERBOARD_MS = 5000;
/** From MIN correct answers in a row: fire on the avatar (four sizes) and a bonus per answer, growing until MAX. */
export const STREAK_MIN = 3;
export const STREAK_MAX = 8;
const STREAK_BONUS_STEP = 50;

/** +50 at STREAK_MIN in a row, +50 more per answer, capped at STREAK_MAX (+300). */
export const streakBonus = (streak: number) =>
  streak < STREAK_MIN ? 0 : (Math.min(streak, STREAK_MAX) - STREAK_MIN + 1) * STREAK_BONUS_STEP;
export const MAX_AUDIO_MB = 20;

export const audioUrl = (hash: string) => `/media/${hash}.mp3`;
