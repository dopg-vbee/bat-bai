import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Library, newId } from '../src/server/library.ts';
import { FsStore } from '../src/server/storage/fsStore.ts';
import { tempDir } from './helpers.ts';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((fn) => fn()));
});

async function setup() {
  const tmp = await tempDir();
  cleanups.push(tmp.cleanup);
  return tmp.dir;
}

async function addSet(library: Library, name: string) {
  return library.mutate((data) => {
    const now = new Date().toISOString();
    const set = {
      id: newId(),
      name,
      createdAt: now,
      updatedAt: now,
      questions: [
        { id: newId(), title: 'Lạc Trôi', audio: 'a'.repeat(64), youtubeUrl: 'u', youtubeId: 'x', startSec: 5, createdAt: now },
      ],
    };
    data.sets.push(set);
    return set;
  });
}

describe('Library persistence', () => {
  it('survives a restart (new Library instance on the same folder)', async () => {
    const dir = await setup();
    const first = await Library.load(new FsStore(dir));
    const set = await addSet(first, 'Nhạc Việt');

    const reloaded = await Library.load(new FsStore(dir));
    expect(reloaded.getSet(set.id)?.name).toBe('Nhạc Việt');
    expect(reloaded.getSet(set.id)?.questions[0].title).toBe('Lạc Trôi');
  });

  it('keeps a history snapshot per change and prunes the oldest', async () => {
    const dir = await setup();
    const library = await Library.load(new FsStore(dir), 3);
    for (let i = 0; i < 5; i++) {
      await addSet(library, `Bộ ${i}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const history = await readdir(path.join(dir, 'history'));
    expect(history).toHaveLength(3);
  });

  it('recovers from the latest snapshot when library.json is corrupted', async () => {
    const dir = await setup();
    const library = await Library.load(new FsStore(dir));
    const set = await addSet(library, 'Quan trọng');
    await writeFile(path.join(dir, 'library.json'), '{ broken');

    const recovered = await Library.load(new FsStore(dir));
    expect(recovered.getSet(set.id)?.name).toBe('Quan trọng');
  });

  it('soft-deletes: hidden from sets() but kept in the saved data', async () => {
    const dir = await setup();
    const library = await Library.load(new FsStore(dir));
    const set = await addSet(library, 'Xóa thử');
    await library.mutate((data) => {
      data.sets[0].deletedAt = new Date().toISOString();
    });
    expect(library.getSet(set.id)).toBeUndefined();
    const saved = JSON.parse(await readFile(path.join(dir, 'library.json'), 'utf8'));
    expect(saved.sets[0].questions[0].audio).toBe('a'.repeat(64));
  });

  it('does not apply a change whose save failed', async () => {
    const dir = await setup();
    const library = await Library.load(new FsStore(dir));
    await expect(
      library.mutate(() => {
        throw new Error('validation failed');
      }),
    ).rejects.toThrow('validation failed');
    await addSet(library, 'Vẫn chạy tiếp');
    expect(library.sets()).toHaveLength(1);
  });
});
