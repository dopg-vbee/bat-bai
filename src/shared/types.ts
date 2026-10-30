/** A round: question → reveal (answer video) → leaderboard (a few seconds) → next question. */
/** finale: after the last answer, a beat to announce the end before the final results (no ranking). */
export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finale' | 'ended';

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
  /** Played by the server in a "Chơi thử" room. */
  bot: boolean;
  /** Index into TEAMS; null when the room is not played in teams. */
  team: number | null;
}

export interface CorrectEntry extends PlayerIdentity {
  team: number | null;
  /** Everything earned this round, gift included. */
  points: number;
  /** Bonus from a lucky gift box, 0 if none. */
  gift: number;
  /** The gift box stole the bonus from this player (the leader); null for a plain gift. */
  stolenFrom: string | null;
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
  /** Earned this round minus anything stolen from them; can be negative. */
  roundPoints: number;
  /** Correct answers in a row up to this round; 0 once one is missed. */
  streak: number;
  team: number | null;
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
  /** Set when a player (not the admin) opened the room: they run it from here and answer in a box on this screen. */
  ownerId: string | null;
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
  /** Points multiplier: 2 on a lucky question, 3 on the final one, otherwise 1. */
  multiplier: number;
  /** 0 while running; otherwise when the host paused. Clocks show this instant until resumed. */
  pausedAt: number;
  /** The join QR code is shown over the game (toggled from the host menu or a phone remote). */
  joinQr: boolean;
  teamMode: TeamMode;
  /** Best team first; empty when the room is not played in teams. */
  teams: TeamStanding[];
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
  multiplier: number;
  pausedAt: number;
  playerCount: number;
  /** This player opened the room: their phone shows the host controls. */
  owner: boolean;
  /** The owner's lobby list, to kick from; null for everyone else and outside the lobby. */
  members: PlayerIdentity[] | null;
  /** Set only on phones that play the question audio themselves (see AudioMode). */
  audioUrl: string | null;
  nextAudioUrl: string | null;
  me: PlayerIdentity & { score: number; rank: number; delta: number; team: number | null };
  /**
   * streak: correct answers in a row, still counting the previous ones while this question is open.
   * byTeam: in "together" mode, a teammate got it right for the whole team.
   * stolenFrom: whose points the gift box took; robbed: points other players' gift boxes took from this one.
   */
  round: {
    correct: boolean;
    points: number;
    gift: number;
    stolenFrom: string | null;
    robbed: number;
    streak: number;
    byTeam: boolean;
  };
  teamMode: TeamMode;
  /** Held back (null) while a question is open, so one team scoring doesn't re-send every phone. */
  teams: TeamStanding[] | null;
  answer: string | null;
  podium: PodiumEntry[] | null;
}

type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export type GuessResult =
  | { status: 'correct'; points: number; gift: number; streak: number; stolenFrom: string | null }
  /** close: wrong, but nearly the name (a typo or two too many, a word missing). */
  | { status: 'wrong' | 'close' | 'closed' | 'slow' | 'already' | 'paused' };

/**
 * Whose device plays the question audio: the big screen (admin rooms), only the owner's phone
 * (everyone in the same place), or every phone (everyone apart).
 */
export type AudioMode = 'screen' | 'owner' | 'everyone';

export interface OwnerRoomInput {
  setId: string;
  name: string;
  durationSec: number;
  audio: Exclude<AudioMode, 'screen'>;
}

export interface CreateRoomInput {
  password: string;
  setId: string;
  durationSec: number;
  preview?: boolean;
  /** Bots in a preview room (default PREVIEW_BOTS). */
  bots?: number;
  teamMode?: TeamMode;
  /** MIN_TEAMS to TEAMS.length, when playing in teams. */
  teamCount?: number;
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
  /** Emoji thrown from phones since the last batch, anonymous, for the big screen. */
  reactions: (batch: { code: string; emojis: string[] }) => void;
}

export interface ClientToServerEvents {
  time: (cb: (serverNow: number) => void) => void;
  'host:create': (input: CreateRoomInput, cb: (res: Ack<{ code: string; hostToken: string }>) => void) => void;
  /** A player opens a room with a public set and becomes its owner. */
  'owner:create': (
    input: OwnerRoomInput,
    cb: (res: Ack<{ code: string; hostToken: string; playerId: string; token: string }>) => void,
  ) => void;
  'host:join': (input: { code: string; hostToken: string }, cb: (res: Ack) => void) => void;
  'host:next': () => void;
  'host:reveal': () => void;
  'host:end': () => void;
  /** The host screen was closed (navigated away): stop sending it this room's state. */
  'host:leave': () => void;
  'host:pause': () => void;
  'host:joinQr': (shown: boolean) => void;
  /** Deal every player into teams at random, evenly (lobby only). */
  'host:shuffleTeams': () => void;
  'host:resume': () => void;
  /** The answer video finished playing on the big screen. */
  'host:clipEnded': (qIndex: number) => void;
  'host:kick': (playerId: string) => void;
  /** The owner's answer, typed on the host screen of their room. */
  'host:guess': (text: string, cb: (res: GuessResult) => void) => void;
  'player:join': (input: JoinInput, cb: (res: Ack<{ playerId: string; token: string }>) => void) => void;
  'player:guess': (text: string, cb: (res: GuessResult) => void) => void;
  'player:react': (emoji: string) => void;
  /** Switch team, in the lobby only. */
  'player:team': (team: number) => void;
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
  public: boolean;
  questions: QuestionDto[];
}

/** What the home page shows a would-be room owner for each public set. */
export interface PublicSetDto {
  id: string;
  name: string;
  questionCount: number;
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
export const FINALE_MS = 5000;
export const ROOM_NOT_FOUND = 'Không tìm thấy phòng, kiểm tra lại mã nhé';
/** From MIN correct answers in a row: fire on the avatar (four sizes) and a bonus per answer, growing until MAX. */
export const STREAK_MIN = 3;
export const STREAK_MAX = 8;
const STREAK_BONUS_STEP = 50;

/** +50 at STREAK_MIN in a row, +50 more per answer, capped at STREAK_MAX (+300). */
export const streakBonus = (streak: number) =>
  streak < STREAK_MIN ? 0 : (Math.min(streak, STREAK_MAX) - STREAK_MIN + 1) * STREAK_BONUS_STEP;
export const MAX_AUDIO_MB = 20;
/** What a phone can throw at the big screen once it has answered. */
export const REACTIONS = ['👍', '❤️', '😆', '🔥', '👏', '😮'];
/** One reaction a second per player. */
export const REACTION_COOLDOWN_MS = 1000;

/** Whether a question's video can play inside the game; blocked = embedding turned off (or private). */
export type VideoStatus = 'ok' | 'blocked' | 'missing' | 'unknown';

export const audioUrl = (hash: string) => `/media/${hash}.mp3`;

/**
 * Team play: off; teams scored on their members' average; or "together", where a team's first
 * correct answer counts for the whole team (everyone in it shares the points).
 */
export type TeamMode = 'off' | 'average' | 'together';
/** Teams in the order they are handed out; the host picks how many (MIN_TEAMS up to all of them). */
export const TEAMS = [
  { name: 'Đỏ', color: '#ef4444', emoji: '❤️' },
  { name: 'Xanh', color: '#3b82f6', emoji: '💙' },
  { name: 'Vàng', color: '#eab308', emoji: '💛' },
  { name: 'Tím', color: '#a855f7', emoji: '💜' },
  { name: 'Lục', color: '#22c55e', emoji: '💚' },
  { name: 'Cam', color: '#f97316', emoji: '🧡' },
  { name: 'Hồng', color: '#ec4899', emoji: '🩷' },
  { name: 'Ngọc', color: '#06b6d4', emoji: '🩵' },
  { name: 'Nâu', color: '#a16207', emoji: '🤎' },
  { name: 'Xám', color: '#94a3b8', emoji: '🩶' },
];
export const MIN_TEAMS = 2;

export interface TeamStanding {
  /** Index into TEAMS. */
  team: number;
  /** Average score of its members, rounded. */
  score: number;
  members: number;
  /** Places climbed since the question started (negative = dropped), like RankRow.delta. */
  delta: number;
  /** Score gained since the question started. */
  roundPoints: number;
}
