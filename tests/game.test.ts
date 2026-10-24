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
import { PREVIEW_BOTS, ROOM_NOT_FOUND } from '../src/shared/types.ts';
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

  it('stores clip times to a tenth of a second', async () => {
    const set = await admin<QuestionSetDto>('/sets', { method: 'POST', body: JSON.stringify({ name: 'Thập phân' }) });
    const form = new FormData();
    form.set('title', 'Bài lẻ giây');
    form.set('youtubeUrl', 'https://youtu.be/Llw9Q6akRo4');
    form.set('start', '75.3');
    form.set('end', '1:45.55');
    form.set('audio', new Blob([new Uint8Array(fakeMp3())]), 'song.mp3');
    const saved = await admin<QuestionSetDto>(`/sets/${set.id}/questions`, { method: 'POST', body: form });
    expect(saved.questions[0]).toMatchObject({ startSec: 75.3, endSec: 105.6 });
    await admin(`/sets/${set.id}`, { method: 'DELETE' });
  });

  it('reorders questions and rejects an order that does not match the set', async () => {
    const set = await admin<QuestionSetDto>('/sets', { method: 'POST', body: JSON.stringify({ name: 'Thứ tự' }) });
    await addQuestion(set.id, 'Một', 5);
    await addQuestion(set.id, 'Hai', 5);
    const withThree = await addQuestion(set.id, 'Ba', 5);
    const [a, b, c] = withThree.questions.map((q) => q.id);
    const reorder = (order: unknown) => admin<QuestionSetDto>(`/sets/${set.id}/order`, { method: 'PUT', body: JSON.stringify({ order }) });
    const moved = await reorder([c, a, b]);
    expect(moved.questions.map((q) => q.title)).toEqual(['Ba', 'Một', 'Hai']);
    await expect(reorder([c, a])).rejects.toThrow('400');
    await expect(reorder([c, a, a])).rejects.toThrow('400');
    await expect(reorder([c, a, 'khac'])).rejects.toThrow('400');
    // A deleted question stays out of the order.
    await admin(`/sets/${set.id}/questions/${a}`, { method: 'DELETE' });
    expect((await reorder([b, c])).questions.map((q) => q.title)).toEqual(['Hai', 'Ba']);
    await admin(`/sets/${set.id}`, { method: 'DELETE' });
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

    expect(await admin<QuestionSetDto>(`/sets/${set.id}`)).toEqual(set);
    await expect(admin('/sets/khong-co')).rejects.toThrow('404');

    const audio = await fetch(`${base}${set.questions[0].audioUrl}`, { headers: { Range: 'bytes=0-99' } });
    expect(audio.status).toBe(206);
    expect((await audio.arrayBuffer()).byteLength).toBe(100);
  });

  it('creates a room and lets 60 players join', async () => {
    host = client();
    const created = await host.emitWithAck('host:create', { password: PASSWORD, setId: set.id, durationSec: 10 });
    if (!created.ok) throw new Error(created.error);
    code = created.code;
    expect((await fetch(`${base}/api/rooms/${code}`)).status).toBe(200);
    const missing = await fetch(`${base}/api/rooms/${code === '9999' ? '9998' : '9999'}`);
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toBe(ROOM_NOT_FOUND);
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
    expect(hostState!.leaderboard).toEqual([]); // the video gets the whole screen first

    // A late "clip ended" for another round is ignored; the right one opens the leaderboard.
    host.emit('host:clipEnded', 5);
    await sleep(200);
    expect(hostState!.phase).toBe('reveal');
    host.emit('host:clipEnded', 0);
    await waitFor(() => hostState?.phase === 'leaderboard', 3000, 'leaderboard');
    expect(hostState!.answer).toBe('Lạc Trôi');
    expect(hostState!.advanceAt).toBeGreaterThan(Date.now());
    expect(hostState!.leaderboard).toHaveLength(10);
    const scores = hostState!.leaderboard.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('never sends the answer to phones before the reveal', async () => {
    await waitFor(() => players.every((p) => p.states.at(-1)?.phase === 'leaderboard'), 3000, 'player leaderboard');
    for (const p of players) {
      const leaked = p.states.filter((s) => s.phase === 'question' && JSON.stringify(s).includes('Trôi'));
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
    host.emit('host:next'); // skip the rest of the leaderboard
    await waitFor(() => hostState?.phase === 'question' && hostState.qIndex === 1, 3000, 'question 2');
    await sleep(150);
    await players[10].socket.emitWithAck('player:guess', 'noi nay co anh');
    host.emit('host:reveal');
    await waitFor(() => hostState?.phase === 'reveal', 3000, 'manual reveal');
    expect(hostState!.correctFeed.map((e) => e.name)).toEqual([players[10].name]);

    host.emit('host:next'); // skip the clip
    await waitFor(() => hostState?.phase === 'leaderboard', 3000, 'leaderboard 2');
    host.emit('host:next'); // last question: leaderboard → podium
    await waitFor(() => hostState?.phase === 'ended', 3000, 'ended');
    expect(hostState!.leaderboard).toHaveLength(PLAYERS); // the final screen lists everyone
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
    expect(state!.players).toHaveLength(PREVIEW_BOTS);
    expect(state!.nextAudioUrl).toBe(target.audioUrl);

    const missing = await host.emitWithAck('host:create', {
      password: PASSWORD,
      setId: set.id,
      durationSec: 10,
      preview: true,
      questionId: 'nope',
    });
    expect(missing.ok).toBe(false);
  });
});

describe('phone updates', () => {
  it('a phone re-joining on the same connection gets its state again', async () => {
    const set = (await admin<QuestionSetDto[]>('/sets')).find((s) => s.name === 'Nhạc Việt')!;
    const host = client();
    const created = await host.emitWithAck('host:create', { password: PASSWORD, setId: set.id, durationSec: 10 });
    if (!created.ok) throw new Error(created.error);
    const phone = client();
    const states: PlayerState[] = [];
    phone.on('playerState', (s) => states.push(s));
    const joined = await phone.emitWithAck('player:join', { code: created.code, name: 'Lan' });
    if (!joined.ok) throw new Error(joined.error);
    await waitFor(() => states.length === 1, 3000, 'first state');
    await phone.emitWithAck('player:join', { code: created.code, name: 'Lan', token: joined.token });
    await waitFor(() => states.length === 2, 3000, 'state after re-join');
  });

  it('only the phone whose state changed is sent an update during a question', async () => {
    const set = (await admin<QuestionSetDto[]>('/sets')).find((s) => s.name === 'Nhạc Việt')!;
    const host = client();
    const created = await host.emitWithAck('host:create', { password: PASSWORD, setId: set.id, durationSec: 10 });
    if (!created.ok) throw new Error(created.error);
    await host.emitWithAck('host:join', { code: created.code, hostToken: created.hostToken });
    const phones = await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const socket = client();
        const states: PlayerState[] = [];
        socket.on('playerState', (s) => states.push(s));
        await socket.emitWithAck('player:join', { code: created.code, name: `Máy ${i}` });
        return { socket, states };
      }),
    );
    host.emit('host:next');
    await waitFor(() => phones.every((p) => p.states.at(-1)?.phase === 'question'), 3000, 'question');
    await sleep(200);
    const before = phones.map((p) => p.states.length);
    await phones[0].socket.emitWithAck('player:guess', 'lac troi');
    await phones[1].socket.emitWithAck('player:guess', 'sai bét');
    await sleep(300);
    expect(phones.map((p, i) => p.states.length - before[i])).toEqual([1, 0, 0, 0, 0]);
  });
});

describe('switching rooms on the same connection', () => {
  async function createRoom(host: Client, preview: boolean) {
    const set = (await admin<QuestionSetDto[]>('/sets')).find((s) => s.name === 'Nhạc Việt')!;
    const created = await host.emitWithAck('host:create', { password: PASSWORD, setId: set.id, durationSec: 10, preview });
    if (!created.ok) throw new Error(created.error);
    return created;
  }

  it('a host screen stops hearing the "Chơi thử" room it left (no jump into its game)', async () => {
    const host = client();
    const codes: string[] = [];
    host.on('hostState', (s) => codes.push(s.code));
    const trial = await createRoom(host, true);
    await host.emitWithAck('host:join', { code: trial.code, hostToken: trial.hostToken });
    host.emit('host:next'); // bots start playing the trial room

    const real = await createRoom(host, false);
    await host.emitWithAck('host:join', { code: real.code, hostToken: real.hostToken });
    codes.length = 0;
    await sleep(1500); // the trial room keeps changing (countdown, bot answers)
    expect(codes.every((c) => c === real.code)).toBe(true);
  });

  it('closing the host screen of a trial room removes it; a real room survives', async () => {
    const host = client();
    const trial = await createRoom(host, true);
    await host.emitWithAck('host:join', { code: trial.code, hostToken: trial.hostToken });
    host.emit('host:leave');
    await sleep(100);
    expect((await host.emitWithAck('host:join', { code: trial.code, hostToken: trial.hostToken })).ok).toBe(false);

    const real = await createRoom(host, false);
    await host.emitWithAck('host:join', { code: real.code, hostToken: real.hostToken });
    host.emit('host:leave');
    await sleep(100);
    expect((await host.emitWithAck('host:join', { code: real.code, hostToken: real.hostToken })).ok).toBe(true);
  });

  it('a phone joining another room goes offline in the first and only hears the new one', async () => {
    const host = client();
    const first = await createRoom(host, false);
    let firstState: HostState | null = null;
    host.on('hostState', (s) => {
      if (s.code === first.code) firstState = s;
    });
    await host.emitWithAck('host:join', { code: first.code, hostToken: first.hostToken });
    const second = await createRoom(client(), false);

    const phone = client();
    const codes: string[] = [];
    phone.on('playerState', (s) => codes.push(s.code));
    await phone.emitWithAck('player:join', { code: first.code, name: 'Lan' });
    await phone.emitWithAck('player:join', { code: second.code, name: 'Lan' });
    await waitFor(() => firstState?.players[0]?.connected === false, 3000, 'offline in the first room');
    codes.length = 0;
    host.emit('host:next'); // the first room moves on; the phone must not hear it
    await sleep(500);
    expect(codes.every((c) => c === second.code)).toBe(true);
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
