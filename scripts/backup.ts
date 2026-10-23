// Copies everything in the store (library, history, every MP3) into a local folder.
// Usage: npm run backup [-- <output folder>]
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createStore, loadConfig } from '../src/server/config.ts';
import { AUDIO_PREFIX } from '../src/server/library.ts';

const store = createStore(loadConfig());
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(process.argv[2] ?? path.join('backups', stamp));

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

console.log(`Sao lưu từ ${store.description}\n      vào ${outDir}`);
const keys = await store.list('');
let bytes = 0;
let skipped = 0;
for (const key of keys) {
  const target = path.join(outDir, ...key.split('/'));
  // MP3 files never change (named by content hash), so an existing copy is already correct.
  if (key.startsWith(AUDIO_PREFIX) && (await exists(target))) {
    skipped++;
    continue;
  }
  const data = await store.get(key);
  if (!data) continue;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  bytes += data.length;
}
console.log(`✅ Xong: ${keys.length} file (${(bytes / 1024 / 1024).toFixed(1)} MB mới${skipped ? `, bỏ qua ${skipped} MP3 đã có` : ''})`);
