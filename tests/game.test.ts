import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.ts';
import { FsStore } from '../src/server/storage/fsStore.ts';
import type {
  ClientToServerEvents,
  HostState,
  PlayerState,
  QuestionSetDto,
  ServerToClientEvents,
} from '../src/shared/types.ts';
import { fakeMp3, sleep, tempDir, waitFor } from './helpers.ts';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const PASSWORD = 'mật-khẩu';
const PLAYERS = 60;

let app: Awaited<ReturnType<typeof createApp>>;
let base = '';
let tmp: Awaited<ReturnType<typeof tempDir>>;
const sockets: Client[] = [];

async function startServer() {
  app = await createApp({ store: new FsStore(tmp.dir), adminPassword: PASSWORD, countdownMs: 100 });
  await new Promise<void>((resolve) => app.httpServer.listen(0, resolve));
  base = `http://localhost:${(app.httpServer.address() as AddressInfo).port}`;
}

function client(): Client {
  const socket: Client = connect(base, { transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  return socket;
}

async function admin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-admin-password': encodeURIComponent(PASSWORD) };
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/api/admin${path}`, { ...init, headers });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${body.error}`);
  return body as T;
}

async function addQuestion(setId: string, title: string, frames: number, end = '') {
  const form = new FormData();
  form.set('title', title);
  form.set('youtubeUrl', 'https://youtu.be/Llw9Q6akRo4?t=75');
  form.set('end', end);
  form.set('audio', new Blob([new Uint8Array(fakeMp3({ frames, id3Title: title }))]), 'song.mp3');
  return admin<QuestionSetDto>(`/sets/${setId}/questions`, { method: 'POST', body: form });
}

beforeAll(async () => {
  tmp = await tempDir();
  await startServer();
});

afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  await app.close();
  await tmp.cleanup();
});

describe('admin API', () => {
  it('rejects a wrong password', async () => {
    const res = await fetch(`${base}/api/admin/sets`, { headers: { 'x-admin-password': 'nope' } });
    expect(res.status).toBe(401);
  });

  it('rejects a non-MP3 upload with a friendly message', async () => {
    const set = await admin<QuestionSetDto>('/sets', { method: 'POST', body: JSON.stringify({ name: 'Rác' }) });
    const form = new FormData();
    form.set('title', 'X');
    form.set('youtubeUrl', 'https://youtu.be/Llw9Q6akRo4');
    form.set('audio', new Blob(['not audio at all']), 'x.mp3');
    await expect(admin(`/sets/${set.id}/questions`, { method: 'POST', body: form })).rejects.toThrow('MP3');
  });
});

describe('a full game with 60 players', () => {
  let set: QuestionSetDto;
  let host: Client;
  let hostState: HostState | null = null;
  const players: { socket: Client; token: string; name: string; states: PlayerState[] }[] = [];
  let code = '';

  it('stores questions and serves the MP3 with Range support', async () => {
    set = await admin<QuestionSetDto>('/sets', { method: 'POST', body: JSON.stringify({ name: 'Nhạc Việt' }) });
    await expect(addQuestion(set.id, 'Lạc Trôi', 20, '1:00')).rejects.toThrow('phải sau');
    await addQuestion(set.id, 'Lạc Trôi', 20, '1:45');
    set = await addQuestion(set.id, 'Nơi Này Có Anh', 21);
    expect(set.questions).toHaveLength(2);
    expect(set.questions[0]).toMatchObject({ startSec: 75, endSec: 105 });
    expect(set.questions[1].endSec).toBeNull();

    const audio = await fetch(`${base}${set.questions[0].audioUrl}`, { headers: { Range: 'bytes=0-99' } });
    expect(audio.status).toBe(206);
    expect((await audio.arrayBuffer()).byteLength).toBe(100);
  });

  it('creates a room and lets 60 players join', async () => {
    host = client();
    const created = await host.emitWithAck('host:create', { password: PASSWORD, setId: set.id, durationSec: 10, shuffle: false });
    if (!created.ok) throw new Error(created.error);
    code = created.code;
    host.on('hostState', (state) => (hostState = state));
    expect(await host.emitWithAck('host:join', { code, hostToken: created.hostToken })).toEqual({ ok: true });

    const joined = await Promise.all(
      Array.from({ length: PLAYERS }, async (_, i) => {
        const socket = client();
        const states: PlayerState[] = [];
        socket.on('playerState', (state) => states.push(state));
        const name = `Người ${i}`;
        const res = await socket.emitWithAck('player:join', { code, name });
        if (!res.ok) throw new Error(res.error);
        return { socket, token: res.token, name, states };
      }),
    );
    players.push(...joined);
    await waitFor(() => hostState?.players.length === PLAYERS, 5000, '60 players in host view');

    const duplicate = await client().emitWithAck('player:join', { code, name: 'người 0' });
    expect(duplicate.ok).toBe(false);
  });

  it('plays round 1: everyone answers, the round ends early, scores rank by speed', async () => {
    host.emit('host:next');
    await waitFor(() => hostState?.phase === 'question', 3000, 'question phase');
    expect(hostState!.answer).toBeNull();
    expect(hostState!.clip).toMatchObject({ startSec: 75, endSec: 105 });
    await sleep(150); // countdown

    // First player tries a wrong answer, then the right one after the rate limit.
    expect(await players[0].socket.emitWithAck('player:guess', 'Nơi này có anh')).toEqual({ status: 'wrong' });
    await sleep(350);
    const results = [];
    for (const [i, p] of players.entries()) {
      results.push(await p.socket.emitWithAck('player:guess', i % 2 ? 'lac troi' : 'Lạc Trôi'));
    }
    expect(results.every((r) => r.status === 'correct')).toBe(true);
    const again = await players[1].socket.emitWithAck('player:guess', 'lac troi');
    expect(again.status).toBe('already');

    await waitFor(() => hostState?.phase === 'reveal', 3000, 'early reveal');
    expect(hostState!.answer).toBe('Lạc Trôi');
    expect(hostState!.clip).toMatchObject({ startSec: 75, endSec: 105 });
    expect(hostState!.correctFeed).toHaveLength(PLAYERS);
    expect(hostState!.leaderboard).toHaveLength(10);
    const scores = hostState!.leaderboard.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('never sends the answer to phones before the reveal', async () => {
    await waitFor(() => players.every((p) => p.states.at(-1)?.phase === 'reveal'), 3000, 'player reveal');
    for (const p of players) {
      const leaked = p.states.filter((s) => s.phase !== 'reveal' && JSON.stringify(s).includes('Trôi'));
      expect(leaked).toEqual([]);
      expect(p.states.at(-1)!.answer).toBe('Lạc Trôi');
    }
  });

  it('keeps the score when a player reconnects with their token', async () => {
    const p = players[5];
    const before = p.states.at(-1)!.me.score;
    p.socket.disconnect();
    await waitFor(() => hostState?.players.find((x) => x.name === p.name)?.connected === false, 3000, 'offline');

    const socket = client();
    const states: PlayerState[] = [];
    socket.on('playerState', (state) => states.push(state));
    const res = await socket.emitWithAck('player:join', { code, name: 'ignored', token: p.token });
    expect(res.ok).toBe(true);
    await waitFor(() => states.length > 0, 3000, 'state after rejoin');
    expect(states.at(-1)!.me.score).toBe(before);
    expect(states.at(-1)!.me.name).toBe(p.name);
    players[5] = { ...p, socket, states };
  });

  it('plays round 2 with a manual reveal, then ends with a podium', async () => {
    host.emit('host:next');
    await waitFor(() => hostState?.phase === 'question' && hostState.qIndex === 1, 3000, 'question 2');
    await sleep(150);
    await players[10].socket.emitWithAck('player:guess', 'noi nay co anh');
    host.emit('host:reveal');
    await waitFor(() => hostState?.phase === 'reveal', 3000, 'manual reveal');
    expect(hostState!.correctFeed.map((e) => e.name)).toEqual([players[10].name]);

    host.emit('host:next');
    await waitFor(() => hostState?.phase === 'ended', 3000, 'ended');
    await waitFor(() => players[0].states.at(-1)?.phase === 'ended', 3000, 'player ended');
    const final = players[0].states.at(-1)!;
    expect(final.podium).toHaveLength(3);
    expect(final.podium![0].name).toBe(players[10].name);
  });
});

describe('preview rooms', () => {
  it('can preview a single question with bots', async () => {
    const set = (await admin<QuestionSetDto[]>('/sets')).find((s) => s.name === 'Nhạc Việt')!;
    const target = set.questions[1];
    const host = client();
    const created = await host.emitWithAck('host:create', {
      password: PASSWORD,
      setId: set.id,
      durationSec: 10,
      shuffle: false,
      preview: true,
      questionId: target.id,
    });
    if (!created.ok) throw new Error(created.error);
    let state: HostState | null = null;
    host.on('hostState', (s) => (state = s));
    await host.emitWithAck('host:join', { code: created.code, hostToken: created.hostToken });
    await waitFor(() => state !== null, 3000, 'host state');
    expect(state!.preview).toBe(true);
    expect(state!.qTotal).toBe(1);
    expect(state!.players).toHaveLength(8);
    expect(state!.nextAudioUrl).toBe(target.audioUrl);

    const missing = await host.emitWithAck('host:create', {
      password: PASSWORD,
      setId: set.id,
      durationSec: 10,
      shuffle: false,
      preview: true,
      questionId: 'nope',
    });
    expect(missing.ok).toBe(false);
  });
});

describe('durability', () => {
  it('keeps every question after the server restarts', async () => {
    const before = await admin<QuestionSetDto[]>('/sets');
    sockets.forEach((s) => s.disconnect());
    await app.close();
    await startServer();

    const after = await admin<QuestionSetDto[]>('/sets');
    expect(after).toEqual(before);
    const audio = await fetch(`${base}${after.find((s) => s.name === 'Nhạc Việt')!.questions[0].audioUrl}`);
    expect(audio.status).toBe(200);
  });
});
