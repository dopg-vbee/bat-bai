import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** MPEG-1 Layer III, 128 kbps, 44.1 kHz: every frame is 417 bytes. */
export function fakeMp3({ frames = 20, id3Title }: { frames?: number; id3Title?: string } = {}): Buffer {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x64]);
  const body = Buffer.concat(Array.from({ length: frames }, () => frame));
  if (!id3Title) return body;
  const tag = Buffer.from(`TIT2${id3Title}`, 'latin1');
  const header = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, (tag.length >> 7) & 0x7f, tag.length & 0x7f]);
  return Buffer.concat([header, tag, body]);
}

export async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'batbai-test-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(check: () => boolean, timeoutMs = 5000, label = 'condition') {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await sleep(20);
  }
}
