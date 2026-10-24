import http from 'node:http';
import path from 'node:path';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import multer from 'multer';
import { Server } from 'socket.io';
import { MAX_AUDIO_MB, ROOM_NOT_FOUND } from '../shared/types.ts';
import { adminRouter } from './admin.ts';
import { AudioError } from './audio.ts';
import { HttpError } from './errors.ts';
import { AUDIO_PREFIX, audioKey, Library } from './library.ts';
import { lanAddresses } from './network.ts';
import { setupRealtime, type GameServer } from './realtime.ts';
import type { BlobStore } from './storage/types.ts';

interface AppOptions {
  store: BlobStore;
  adminPassword: string;
  countdownMs?: number;
  /** Address phones should open (QR code), e.g. https://bat-bai.example.com. Overrides LAN detection. */
  publicUrl?: string;
  /** dev = Vite middleware with HMR, static = serve dist/client, none = API only (tests). */
  client?: 'dev' | 'static' | 'none';
}

const CLIENT_DIR = path.resolve(import.meta.dirname, '../../dist/client');
/** MP3s kept in memory (oldest dropped first); clips are ~0.2–1MB, uploads up to 20MB. */
const AUDIO_CACHE_BYTES = 64 * 1024 * 1024;

/** Only live questions matter: deleted ones keep their (possibly gone) audio for history. */
async function warnMissingAudio(library: Library, store: BlobStore) {
  const stored = new Set(await store.list(AUDIO_PREFIX));
  const broken = library
    .sets()
    .flatMap((set) => set.questions.filter((q) => !stored.has(audioKey(q.audio))).map((q) => `"${q.title}" (bộ ${set.name})`));
  if (broken.length) console.warn(`⚠️  ${broken.length} câu thiếu file MP3, hãy upload lại: ${broken.join(', ')}`);
}

/** Serves stored MP3s with Range support (Safari requires 206 responses for media). */
function mediaHandler(store: BlobStore): RequestHandler {
  const cache = new Map<string, Buffer>();
  let cachedBytes = 0;
  return async (req, res) => {
    const match = /^([a-f0-9]{64})\.mp3$/.exec(String(req.params.file));
    if (!match) return void res.sendStatus(404);
    let data = cache.get(match[1]);
    if (!data) {
      data = (await store.get(audioKey(match[1]))) ?? undefined;
      if (!data) return void res.sendStatus(404);
      cache.set(match[1], data);
      cachedBytes += data.length;
      for (const [hash, old] of cache) {
        if (cachedBytes <= AUDIO_CACHE_BYTES || cache.size === 1) break;
        cache.delete(hash);
        cachedBytes -= old.length;
      }
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
  app.get('/api/info', async (_req, res) => {
    res.json({ publicUrl: options.publicUrl ?? null, lanAddresses: await lanAddresses() });
  });
  /** Lets the home page turn away a wrong room code before opening the room. */
  app.get('/api/rooms/:code', (req, res) => {
    if (realtime.rooms.has(req.params.code)) res.json({ ok: true });
    else res.status(404).json({ error: ROOM_NOT_FOUND });
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
