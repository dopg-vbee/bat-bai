import { randomBytes } from 'node:crypto';
import type { BlobStore } from './storage/types.ts';

export interface Question {
  id: string;
  title: string;
  /** sha256 of the stored MP3 (key: audio/<hash>.mp3). */
  audio: string;
  youtubeUrl: string;
  youtubeId: string;
  startSec: number;
  /** Absent in libraries saved before clip ranges existed; treated as null. */
  endSec?: number | null;
  createdAt: string;
  deletedAt?: string;
}

export interface QuestionSet {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  /** Room owners (players without the admin password) may open a room with a public set. */
  public?: boolean;
  questions: Question[];
}

export interface LibraryData {
  version: 1;
  updatedAt: string;
  sets: QuestionSet[];
}

export const LIBRARY_KEY = 'library.json';
export const HISTORY_PREFIX = 'history/';
export const AUDIO_PREFIX = 'audio/';
const HISTORY_LIMIT = 100;

export const newId = () => randomBytes(6).toString('base64url');
export const audioKey = (hash: string) => `${AUDIO_PREFIX}${hash}.mp3`;

export function parseLibrary(raw: Buffer | null): LibraryData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw.toString('utf8')) as LibraryData;
    return data?.version === 1 && Array.isArray(data.sets) ? data : null;
  } catch {
    return null;
  }
}

export const historyKey = (iso: string, suffix = '') =>
  `${HISTORY_PREFIX}library-${iso.replace(/[:.]/g, '-')}${suffix}.json`;

/**
 * The question library lives in one JSON document. Every change is written to
 * history/ first and then to library.json, so any earlier version can be restored.
 * Nothing is ever hard-deleted: sets and questions are only marked deletedAt.
 */
export class Library {
  private data: LibraryData;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly store: BlobStore;
  private readonly historyLimit: number;

  private constructor(store: BlobStore, data: LibraryData, historyLimit: number) {
    this.store = store;
    this.data = data;
    this.historyLimit = historyLimit;
  }

  static async load(store: BlobStore, historyLimit = HISTORY_LIMIT): Promise<Library> {
    // A read error (network, permissions) throws here on purpose: starting with an
    // empty library and saving over the real one would be far worse than not starting.
    let data = parseLibrary(await store.get(LIBRARY_KEY));
    if (!data) {
      const snapshots = await store.list(HISTORY_PREFIX);
      for (const key of snapshots.reverse()) {
        data = parseLibrary(await store.get(key));
        if (data) {
          console.warn(`⚠️  library.json thiếu/hỏng, đã khôi phục từ ${key}`);
          break;
        }
      }
    }
    const empty: LibraryData = { version: 1, updatedAt: new Date().toISOString(), sets: [] };
    return new Library(store, data ?? empty, historyLimit);
  }

  /** Live (not deleted) sets with their live questions. */
  sets(): QuestionSet[] {
    return this.data.sets
      .filter((set) => !set.deletedAt)
      .map((set) => ({ ...set, questions: set.questions.filter((q) => !q.deletedAt) }));
  }

  getSet(id: string): QuestionSet | undefined {
    return this.sets().find((set) => set.id === id);
  }

  /** Applies `change` to a copy, persists it, then swaps it in. Changes run one at a time. */
  mutate<T>(change: (draft: LibraryData) => T): Promise<T> {
    const run = async () => {
      const draft = structuredClone(this.data);
      const result = change(draft);
      draft.updatedAt = new Date().toISOString();
      await this.save(draft);
      this.data = draft;
      return result;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async save(data: LibraryData): Promise<void> {
    const body = Buffer.from(JSON.stringify(data, null, 2));
    await this.store.put(historyKey(data.updatedAt), body, 'application/json');
    await this.store.put(LIBRARY_KEY, body, 'application/json');
    const snapshots = await this.store.list(HISTORY_PREFIX);
    const excess = snapshots.slice(0, Math.max(0, snapshots.length - this.historyLimit));
    for (const key of excess) await this.store.delete(key);
  }
}
