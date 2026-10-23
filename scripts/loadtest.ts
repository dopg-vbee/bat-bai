// Plays complete games with bot players against a running server and reports latency.
// Usage: npm run loadtest -- [--url http://localhost:3000] [--rooms 3] [--players 60] [--duration 15]
// Needs ADMIN_PASSWORD (env or --password) and at least one question set with questions.
import { parseArgs } from 'node:util';
import { io as connect, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, HostState, PlayerState, QuestionSetDto, ServerToClientEvents } from '../src/shared/types.ts';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    password: { type: 'string', default: process.env.ADMIN_PASSWORD ?? 'batbai' },
    rooms: { type: 'string', default: '1' },
    players: { type: 'string', default: '60' },
    duration: { type: 'string', default: '15' },
    questions: { type: 'string', default: '3' },
  },
});
const url = values.url!;
const roomCount = Number(values.rooms);
const playerCount = Number(values.players);
const durationSec = Number(values.duration);
const maxQuestions = Number(values.questions);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const latencies = { join: [] as number[], guess: [] as number[] };
const errors: string[] = [];
const sockets: Client[] = [];

function client(): Client {
  const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  return socket;
}

async function timed<T>(kind: keyof typeof latencies, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  latencies[kind].push(performance.now() - start);
  return result;
}

const res = await fetch(`${url}/api/admin/sets`, { headers: { 'x-admin-password': encodeURIComponent(values.password!) } });
if (!res.ok) throw new Error(`Admin API ${res.status}: kiểm tra --url và --password`);
const sets = ((await res.json()) as QuestionSetDto[]).filter((s) => s.questions.length);
if (!sets.length) throw new Error('Cần ít nhất một bộ đề có câu hỏi');
const set = sets[0];
const titles = new Map(set.questions.map((q) => [q.audioUrl, q.title]));

async function playRoom(roomNo: number) {
  const host = client();
  const created = await host.timeout(5000).emitWithAck('host:create', {
    password: values.password!,
    setId: set.id,
    durationSec,
    shuffle: true,
  });
  if (!created.ok) throw new Error(created.error);
  let hostState: HostState | null = null;
  host.on('hostState', (s) => (hostState = s));
  await host.timeout(5000).emitWithAck('host:join', { code: created.code, hostToken: created.hostToken });

  const bots = await Promise.all(
    Array.from({ length: playerCount }, async (_, i) => {
      const socket = client();
      const bot = { socket, state: null as PlayerState | null, answered: -1 };
      socket.on('playerState', (s) => (bot.state = s));
      const joined = await timed('join', () => socket.timeout(10_000).emitWithAck('player:join', { code: created.code, name: `Bot ${roomNo}-${i}` }));
      if (!joined.ok) errors.push(joined.error);
      return bot;
    }),
  );
  console.log(`Phòng ${created.code}: ${bots.length} bot đã vào`);

  const rounds = Math.min(maxQuestions, set.questions.length);
  for (let round = 0; round < rounds; round++) {
    host.emit('host:next');
    while ((hostState as HostState | null)?.phase !== 'question') await sleep(20);
    const { startsAt, audioUrl } = hostState! as HostState;
    // Bots don't receive the answer: the load test reads it from the admin API, like a cheating friend.
    const title = titles.get(audioUrl!)!;
    await sleep(Math.max(0, startsAt - Date.now()) + 50);
    await Promise.all(
      bots.map(async (bot, i) => {
        await sleep(Math.random() * (durationSec * 600));
        if (i % 5 === 0) await timed('guess', () => bot.socket.timeout(5000).emitWithAck('player:guess', 'sai bét'));
        await sleep(350);
        if (i % 7 !== 0) await timed('guess', () => bot.socket.timeout(5000).emitWithAck('player:guess', title));
      }),
    );
    const roundStart = Date.now();
    while ((hostState as HostState | null)?.phase !== 'reveal') {
      if (Date.now() - roundStart > (durationSec + 5) * 1000) throw new Error('Vòng không kết thúc');
      await sleep(50);
    }
    const s = hostState! as HostState;
    console.log(`Phòng ${created.code} câu ${round + 1}: ${s.correctFeed.length}/${bots.length} đúng`);
    await sleep(1000);
  }
  host.emit('host:end');
  while ((hostState as HostState | null)?.phase !== 'ended') await sleep(20);
  await sleep(300);
  const notEnded = bots.filter((b) => b.state?.phase !== 'ended').length;
  if (notEnded) errors.push(`${notEnded} bot không nhận được màn kết thúc ở phòng ${created.code}`);
}

const started = Date.now();
try {
  await Promise.all(Array.from({ length: roomCount }, (_, i) => playRoom(i + 1)));
} finally {
  sockets.forEach((s) => s.disconnect());
}

function report(label: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]?.toFixed(1);
  console.log(`${label} (${sorted.length} lượt): p50 ${pct(50)}ms · p95 ${pct(95)}ms · max ${pct(100)}ms`);
}
console.log(`\n${roomCount} phòng × ${playerCount} người, ${((Date.now() - started) / 1000).toFixed(1)}s`);
report('Vào phòng (gồm cả mở kết nối)', latencies.join);
report('Gửi đáp án', latencies.guess);
console.log(errors.length ? `❌ ${errors.length} lỗi:\n${errors.slice(0, 10).join('\n')}` : '✅ Không có lỗi');
process.exit(errors.length ? 1 : 0);
