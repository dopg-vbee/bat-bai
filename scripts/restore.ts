// Restores the question library. Restart the server afterwards so it reloads library.json.
//   npm run restore -- <backup folder>         upload a backup made by `npm run backup`
//   npm run restore -- --list                  list history snapshots in the store
//   npm run restore -- --history <file name>   roll library.json back to a history snapshot
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createStore, loadConfig } from '../src/server/config.ts';
import { AUDIO_PREFIX, HISTORY_PREFIX, historyKey, LIBRARY_KEY, parseLibrary } from '../src/server/library.ts';

const store = createStore(loadConfig());
const [command, arg] = process.argv.slice(2);

function summary(raw: Buffer | null) {
  const data = parseLibrary(raw);
  if (!data) return 'không đọc được';
  const live = data.sets.filter((s) => !s.deletedAt);
  const questions = live.reduce((n, s) => n + s.questions.filter((q) => !q.deletedAt).length, 0);
  return `${live.length} bộ đề, ${questions} câu (sửa lần cuối ${data.updatedAt})`;
}

/** Keeps the current library as a snapshot, so a restore can itself be undone. */
async function saveCurrent() {
  const current = await store.get(LIBRARY_KEY);
  if (!current) return;
  const key = historyKey(new Date().toISOString(), '-before-restore');
  await store.put(key, current, 'application/json');
  console.log(`   Bản hiện tại đã được giữ lại: ${key}`);
}

async function listFiles(dir: string, rel = ''): Promise<string[]> {
  const entries = await readdir(path.join(dir, rel), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? listFiles(dir, path.posix.join(rel, e.name)) : [path.posix.join(rel, e.name)])),
  );
  return nested.flat();
}

if (command === '--list') {
  const keys = await store.list(HISTORY_PREFIX);
  for (const key of keys) console.log(`${key.slice(HISTORY_PREFIX.length)}  →  ${summary(await store.get(key))}`);
  console.log(`\n${keys.length} bản. Hiện tại: ${summary(await store.get(LIBRARY_KEY))}`);
} else if (command === '--history' && arg) {
  const data = await store.get(`${HISTORY_PREFIX}${path.basename(arg)}`);
  if (!parseLibrary(data)) throw new Error(`Không tìm thấy hoặc không đọc được snapshot ${arg}`);
  await saveCurrent();
  await store.put(LIBRARY_KEY, data!, 'application/json');
  console.log(`✅ Đã khôi phục: ${summary(data)}\n   Nhớ khởi động lại server.`);
} else if (command && !command.startsWith('--')) {
  const dir = path.resolve(command);
  const library = await readFile(path.join(dir, LIBRARY_KEY)).catch(() => null);
  if (!parseLibrary(library)) throw new Error(`${dir} không có library.json hợp lệ`);
  console.log(`Khôi phục ${summary(library)}\n   từ ${dir}\n   vào ${store.description}`);
  await saveCurrent();
  let uploaded = 0;
  for (const key of await listFiles(dir)) {
    if (key === LIBRARY_KEY) continue;
    if (key.startsWith(AUDIO_PREFIX) && (await store.has(key))) continue;
    if (!key.startsWith(AUDIO_PREFIX) && !key.startsWith(HISTORY_PREFIX)) continue;
    const type = key.endsWith('.mp3') ? 'audio/mpeg' : 'application/json';
    await store.put(key, await readFile(path.join(dir, key)), type);
    uploaded++;
  }
  await store.put(LIBRARY_KEY, library!, 'application/json');
  console.log(`✅ Xong (${uploaded} file tải lên). Nhớ khởi động lại server.`);
} else {
  console.log('Cách dùng:\n  npm run restore -- <thư mục backup>\n  npm run restore -- --list\n  npm run restore -- --history <tên file>');
  process.exitCode = 1;
}
