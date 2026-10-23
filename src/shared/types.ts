/** A round: question → reveal (answer video) → leaderboard (a few seconds) → next question. */
export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

export interface PlayerIdentity {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface PlayerSummary extends PlayerIdentity {
  score: number;
  connected: boolean;
  correct: boolean;
}

export interface CorrectEntry extends PlayerIdentity {
  points: number;
}

export interface RankRow extends PlayerIdentity {
  score: number;
  rank: number;
  /** Positive = moved up since the start of the round. */
  delta: number;
  roundPoints: number;
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
  /** Filled during the leaderboard phase and at the end. */
  leaderboard: RankRow[];
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
  pausedAt: number;
  playerCount: number;
  me: PlayerIdentity & { score: number; rank: number; delta: number };
  round: { correct: boolean; points: number };
  answer: string | null;
  podium: PodiumEntry[] | null;
}

export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export type GuessResult =
  | { status: 'correct'; points: number }
  | { status: 'wrong' | 'closed' | 'slow' | 'already' | 'paused' };

export interface CreateRoomInput {
  password: string;
  setId: string;
  durationSec: number;
  shuffle: boolean;
  preview?: boolean;
  /** Preview a single question instead of the whole set. */
  questionId?: string;
}

export interface JoinInput {
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
  'host:pause': () => void;
  'host:resume': () => void;
  /** The answer video finished playing on the big screen. */
  'host:clipEnded': (qIndex: number) => void;
  'host:kick': (playerId: string) => void;
  'player:join': (input: JoinInput, cb: (res: Ack<{ playerId: string; token: string }>) => void) => void;
  'player:guess': (text: string, cb: (res: GuessResult) => void) => void;
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
export const PREVIEW_BOTS = 4;
/** Answer clips without an end mark play this long. */
export const OPEN_CLIP_SEC = 25;
export const LEADERBOARD_MS = 5000;
export const MAX_AUDIO_MB = 20;

export const audioUrl = (hash: string) => `/media/${hash}.mp3`;
