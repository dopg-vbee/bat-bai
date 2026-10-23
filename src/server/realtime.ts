import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/types.ts';
import { checkPassword } from './auth.ts';
import { pickLuck, Room, type GameQuestion } from './game/room.ts';
import type { Library } from './library.ts';

interface SocketData {
  role?: 'host' | 'player';
  code?: string;
  playerId?: string;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Parameters<Parameters<GameServer['on']>[1]>[0];

interface RealtimeOptions {
  adminPassword: string;
  countdownMs: number;
}

const BROADCAST_DELAY_MS = 80;
const SWEEP_INTERVAL_MS = 5 * 60_000;
const IDLE_ROOM_MS = 3 * 60 * 60_000;

const hostChannel = (code: string) => `host:${code}`;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function setupRealtime(io: GameServer, library: Library, options: RealtimeOptions) {
  const rooms = new Map<string, Room>();
  const dirty = new Set<Room>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Changes are coalesced: a burst of 60 joins or correct answers becomes one push per client.
  /** Last state sent to each phone, per room: a phone whose state did not change gets nothing. */
  const sentToPhones = new WeakMap<Room, Map<string, string>>();

  function flush() {
    flushTimer = null;
    for (const room of dirty) {
      if (rooms.get(room.code) !== room) continue;
      io.to(hostChannel(room.code)).emit('hostState', room.hostView());
      const previous = sentToPhones.get(room);
      const current = new Map<string, string>();
      for (const { socketId, state } of room.playerViews()) {
        const json = JSON.stringify(state);
        current.set(socketId, json);
        if (previous?.get(socketId) !== json) io.to(socketId).emit('playerState', state);
      }
      sentToPhones.set(room, current);
    }
    dirty.clear();
  }

  function markDirty(room: Room) {
    dirty.add(room);
    flushTimer ??= setTimeout(flush, BROADCAST_DELAY_MS);
  }

  function newCode(): string {
    for (;;) {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      if (!rooms.has(code)) return code;
    }
  }

  /** Unbinds a socket from the room it was in, so that room stops pushing state to it. */
  function detach(socket: GameSocket, { closingHostScreen = false } = {}) {
    const { role, code, playerId } = socket.data;
    const room = rooms.get(code ?? '');
    socket.data = {};
    if (!room) return;
    if (role === 'player' && playerId) room.leave(playerId, socket.id);
    if (role !== 'host') return;
    socket.leave(hostChannel(room.code));
    // A "Chơi thử" room nobody is watching would keep playing itself with bots: drop it.
    // (A reload disconnects without closing the screen, so the room survives that.)
    if (closingHostScreen && room.preview && !io.sockets.adapter.rooms.get(hostChannel(room.code))?.size) {
      room.dispose();
      rooms.delete(room.code);
    }
  }

  io.on('connection', (socket) => {
    const hostRoom = () => (socket.data.role === 'host' ? rooms.get(socket.data.code ?? '') : undefined);

    socket.on('time', (cb) => {
      if (typeof cb === 'function') cb(Date.now());
    });

    socket.on('host:create', (input, cb) => {
      if (typeof cb !== 'function') return;
      if (!checkPassword(input?.password, options.adminPassword)) return cb({ ok: false, error: 'Sai mật khẩu' });
      const set = library.getSet(String(input.setId));
      if (!set?.questions.length) return cb({ ok: false, error: 'Bộ đề chưa có câu hỏi nào' });

      const picked = input.questionId ? set.questions.filter((q) => q.id === input.questionId) : set.questions;
      if (!picked.length) return cb({ ok: false, error: 'Không tìm thấy câu hỏi' });

      const questions: GameQuestion[] = picked.map((q) => ({
        title: q.title,
        audio: q.audio,
        youtubeId: q.youtubeId,
        startSec: q.startSec,
        endSec: q.endSec ?? null,
      }));
      const room: Room = new Room({
        code: newCode(),
        setName: set.name,
        questions: input.shuffle ? shuffle(questions) : questions,
        durationMs: clamp(Math.round(Number(input.durationSec) || 30), 10, 120) * 1000,
        countdownMs: options.countdownMs,
        preview: Boolean(input.preview),
        bots: Math.round(Number(input.bots)) || undefined,
        luck: pickLuck(questions.length),
        onChange: () => markDirty(room),
      });
      rooms.set(room.code, room);
      cb({ ok: true, code: room.code, hostToken: room.hostToken });
    });

    socket.on('host:join', (input, cb) => {
      if (typeof cb !== 'function') return;
      const room = rooms.get(String(input?.code));
      if (!room || room.hostToken !== input.hostToken) {
        return cb({ ok: false, error: 'Phòng không còn tồn tại (có thể server vừa khởi động lại)' });
      }
      if (socket.data.code !== room.code) detach(socket);
      socket.data = { role: 'host', code: room.code };
      socket.join(hostChannel(room.code));
      socket.emit('hostState', room.hostView());
      cb({ ok: true });
    });

    socket.on('host:next', () => hostRoom()?.next());
    socket.on('host:reveal', () => {
      const room = hostRoom();
      room?.resume();
      room?.reveal();
    });
    socket.on('host:pause', () => hostRoom()?.pause());
    socket.on('host:resume', () => hostRoom()?.resume());
    socket.on('host:joinQr', (shown) => hostRoom()?.showJoinQr(Boolean(shown)));
    socket.on('host:end', () => hostRoom()?.finish());
    socket.on('host:clipEnded', (qIndex) => hostRoom()?.clipEnded(Number(qIndex)));
    socket.on('host:kick', (playerId) => {
      const socketId = hostRoom()?.kick(String(playerId));
      const target = socketId ? io.sockets.sockets.get(socketId) : undefined;
      if (!target) return;
      target.data = {};
      target.emit('kicked');
    });

    socket.on('player:join', (input, cb) => {
      if (typeof cb !== 'function') return;
      const room = rooms.get(String(input?.code));
      if (!room) return cb({ ok: false, error: 'Không tìm thấy phòng, kiểm tra lại mã nhé' });
      // Joining another room (e.g. "Chơi phòng khác") leaves the previous one.
      if (socket.data.code && socket.data.code !== room.code) detach(socket);
      const result = room.join(String(input.name ?? ''), input.token ? String(input.token) : undefined, socket.id);
      if (typeof result === 'string') return cb({ ok: false, error: result });
      socket.data = { role: 'player', code: room.code, playerId: result.id };
      // A (re)joining screen has no state yet: make the next flush send it even if unchanged.
      sentToPhones.get(room)?.delete(socket.id);
      cb({ ok: true, playerId: result.id, token: result.token });
    });

    socket.on('player:guess', (text, cb) => {
      if (typeof cb !== 'function') return;
      const { role, code, playerId } = socket.data;
      const room = role === 'player' ? rooms.get(code ?? '') : undefined;
      if (!room || !playerId) return cb({ status: 'closed' });
      cb(room.guess(playerId, String(text ?? '')));
    });

    socket.on('host:leave', () => detach(socket, { closingHostScreen: true }));
    socket.on('player:leave', () => detach(socket));
    socket.on('disconnect', () => detach(socket));
  });

  const sweep = setInterval(() => {
    const cutoff = Date.now() - IDLE_ROOM_MS;
    for (const [code, room] of rooms) {
      if (room.lastActivity >= cutoff) continue;
      room.dispose();
      rooms.delete(code);
    }
  }, SWEEP_INTERVAL_MS);
  sweep.unref();

  return {
    rooms,
    close() {
      clearInterval(sweep);
      if (flushTimer) clearTimeout(flushTimer);
      for (const room of rooms.values()) room.dispose();
      rooms.clear();
    },
  };
}
