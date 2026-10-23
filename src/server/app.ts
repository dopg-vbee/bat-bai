import http from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import multer from 'multer';
import { Server } from 'socket.io';
import { MAX_AUDIO_MB } from '../shared/types.ts';
import { adminRouter } from './admin.ts';
import { AudioError } from './audio.ts';
import { HttpError } from './errors.ts';
import { AUDIO_PREFIX, audioKey, Library } from './library.ts';
import { setupRealtime, type GameServer } from './realtime.ts';
import type { BlobStore } from './storage/types.ts';

export interface AppOptions {
  store: BlobStore;
  adminPassword: string;
  countdownMs?: number;
  /** dev = Vite middleware with HMR, static = serve dist/client, none = API only (tests). */
  client?: 'dev' | 'static' | 'none';
}

const CLIENT_DIR = path.resolve(import.meta.dirname, '../../dist/client');
const AUDIO_CACHE_SIZE = 40;

export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}

async function warnMissingAudio(library: Library, store: BlobStore) {
  const stored = new Set(await store.list(AUDIO_PREFIX));
  const missing = [...library.referencedAudio()].filter((hash) => !stored.has(audioKey(hash)));
  if (missing.length) console.warn(`⚠️  Thiếu ${missing.length} file MP3 trong kho lưu trữ: ${missing.join(', ')}`);
}

/** Serves stored MP3s with Range support (Safari requires 206 responses for media). */
function mediaHandler(store: BlobStore): RequestHandler {
  const cache = new Map<string, Buffer>();
  return async (req, res) => {
    const match = /^([a-f0-9]{64})\.mp3$/.exec(String(req.params.file));
    if (!match) return void res.sendStatus(404);
    let data = cache.get(match[1]);
    if (!data) {
      data = (await store.get(audioKey(match[1]))) ?? undefined;
      if (!data) return void res.sendStatus(404);
      cache.set(match[1], data);
      if (cache.size > AUDIO_CACHE_SIZE) cache.delete(cache.keys().next().value!);
    }
    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    });
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.get('range') ?? '');
    if (!range || (!range[1] && !range[2])) return void res.send(data);
    const size = data.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return void res.status(416).set('Content-Range', `bytes */${size}`).end();
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`).send(data.subarray(start, end + 1));
  };
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) return void res.status(error.status).json({ error: error.message });
  if (error instanceof AudioError) return void res.status(400).json({ error: error.message });
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? `File quá lớn (tối đa ${MAX_AUDIO_MB}MB)` : error.message;
    return void res.status(400).json({ error: message });
  }
  // body-parser errors (malformed JSON, too large) carry their own 4xx status.
  if (typeof error?.status === 'number' && error.status < 500) {
    return void res.status(error.status).json({ error: 'Yêu cầu không hợp lệ' });
  }
  console.error(error);
  res.status(500).json({ error: 'Lỗi máy chủ, thử lại sau nhé' });
};

export async function createApp(options: AppOptions) {
  const { store, adminPassword, countdownMs = 3000, client = 'none' } = options;
  const library = await Library.load(store);
  await warnMissingAudio(library, store);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  const httpServer = http.createServer(app);
  // destroyUpgrade off: Vite's HMR websocket shares this HTTP server in dev.
  const io: GameServer = new Server(httpServer, { destroyUpgrade: false, maxHttpBufferSize: 100_000 });
  const realtime = setupRealtime(io, library, { adminPassword, countdownMs });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: realtime.rooms.size });
  });
  app.get('/api/info', (_req, res) => {
    res.json({ lanAddresses: lanAddresses() });
  });
  app.use('/api/admin', adminRouter(library, store, adminPassword));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.get('/media/:file', mediaHandler(store));

  if (client === 'dev') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      configFile: path.resolve(import.meta.dirname, '../../vite.config.ts'),
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (client === 'static') {
    app.use(
      express.static(CLIENT_DIR, {
        index: false,
        setHeaders: (res, file) => {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (file.includes(`${path.sep}emoji${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=86400');
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(CLIENT_DIR, 'index.html'));
    });
  }
  app.use(errorHandler);

  return {
    httpServer,
    io,
    library,
    realtime,
    close: () =>
      new Promise<void>((resolve) => {
        realtime.close();
        io.close(() => resolve());
      }),
  };
}
