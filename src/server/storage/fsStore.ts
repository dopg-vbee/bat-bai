import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { BlobStore } from './types.ts';

const isNotFound = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';
const isBusy = (error: unknown) => ['EPERM', 'EBUSY', 'EACCES'].includes((error as NodeJS.ErrnoException)?.code ?? '');

/** Stores blobs as files under one folder. Writes go to a temp file, fsync, then rename (atomic). */
export class FsStore implements BlobStore {
  readonly description: string;
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.description = `thư mục ${this.root}`;
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return full;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.${randomBytes(4).toString('hex')}.tmp`;
    const file = await open(tmp, 'w');
    try {
      await file.writeFile(body);
      await file.sync();
    } finally {
      await file.close();
    }
    // Windows can briefly lock the target while another request reads it.
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(tmp, full);
        return;
      } catch (error) {
        if (!isBusy(error) || attempt >= 5) {
          await rm(tmp, { force: true });
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    const walk = async (dir: string, rel: string) => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
      for (const entry of entries) {
        const key = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), key);
        else if (!entry.name.endsWith('.tmp') && key.startsWith(prefix)) keys.push(key);
      }
    };
    const startRel = prefix.includes('/') ? prefix.slice(0, prefix.lastIndexOf('/')) : '';
    await walk(startRel ? this.resolve(startRel) : this.root, startRel);
    return keys.sort();
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
