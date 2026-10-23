import { Router, type Request } from 'express';
import multer from 'multer';
import { audioUrl, MAX_AUDIO_MB, type QuestionSetDto } from '../shared/types.ts';
import { parseTimestamp, parseYoutube } from '../shared/youtube.ts';
import { prepareMp3, sha256 } from './audio.ts';
import { checkPassword } from './auth.ts';
import { HttpError } from './errors.ts';
import { audioKey, newId, type Library, type LibraryData, type QuestionSet } from './library.ts';
import type { BlobStore } from './storage/types.ts';
import { createVideoChecker } from './youtubeCheck.ts';

const YOUTUBE_ID = /^[\w-]{11}$/;

const toSetDto = (set: QuestionSet): QuestionSetDto => ({
  id: set.id,
  name: set.name,
  updatedAt: set.updatedAt,
  questions: set.questions
    .filter((q) => !q.deletedAt)
    .map((q) => ({
      id: q.id,
      title: q.title,
      audioUrl: audioUrl(q.audio),
      youtubeUrl: q.youtubeUrl,
      youtubeId: q.youtubeId,
      startSec: q.startSec,
      endSec: q.endSec ?? null,
    })),
});

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function findSet(data: LibraryData, id: string): QuestionSet {
  const set = data.sets.find((s) => s.id === id && !s.deletedAt);
  if (!set) throw new HttpError(404, 'Không tìm thấy bộ đề');
  return set;
}

function readQuestionFields(body: Record<string, unknown>) {
  const title = cleanText(body.title, 200);
  if (!title) throw new HttpError(400, 'Hãy nhập tên bài hát');
  const youtubeUrl = cleanText(body.youtubeUrl, 500);
  const youtube = parseYoutube(youtubeUrl);
  if (!youtube) throw new HttpError(400, 'Link YouTube không hợp lệ');
  const startInput = cleanText(body.start, 20);
  const startSec = startInput ? parseTimestamp(startInput) : youtube.start;
  if (startSec === null) throw new HttpError(400, 'Thời điểm bắt đầu không hợp lệ (ví dụ: 1:30)');
  const endInput = cleanText(body.end, 20);
  const endSec = endInput ? parseTimestamp(endInput) : youtube.end;
  if (endInput && endSec === null) throw new HttpError(400, 'Thời điểm kết thúc không hợp lệ (ví dụ: 1:50)');
  if (endSec !== null && endSec <= startSec) throw new HttpError(400, 'Thời điểm kết thúc phải sau thời điểm bắt đầu');
  return { title, youtubeUrl, youtubeId: youtube.id, startSec, endSec };
}

export function adminRouter(library: Library, store: BlobStore, password: string): Router {
  const router = Router();
  const checkVideos = createVideoChecker();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_MB * 1024 * 1024, files: 1 } });

  async function saveAudio(file: Express.Multer.File): Promise<string> {
    const data = prepareMp3(file.buffer);
    const hash = sha256(data);
    // Content-addressed: the same file is stored once and never overwritten.
    if (!(await store.has(audioKey(hash)))) await store.put(audioKey(hash), data, 'audio/mpeg');
    return hash;
  }

  router.use((req, res, next) => {
    let given = '';
    try {
      given = decodeURIComponent(req.get('x-admin-password') ?? '');
    } catch {
      // Malformed header: treated as a wrong password.
    }
    if (checkPassword(given, password)) return next();
    res.status(401).json({ error: 'Sai mật khẩu' });
  });

  router.post('/login', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/sets', (_req, res) => {
    res.json(library.sets().map(toSetDto));
  });

  router.get('/sets/:id', (req, res) => {
    const set = library.getSet(req.params.id);
    if (!set) throw new HttpError(404, 'Không tìm thấy bộ đề');
    res.json(toSetDto(set));
  });

  /** Video status of every question of a set, by question id; ?fresh=1 skips the cache. */
  router.get('/sets/:id/videos', async (req, res) => {
    const set = library.getSet(req.params.id);
    if (!set) throw new HttpError(404, 'Không tìm thấy bộ đề');
    const questions = set.questions.filter((q) => !q.deletedAt);
    const byVideo = await checkVideos(questions.map((q) => q.youtubeId), { fresh: req.query.fresh === '1' });
    res.json(Object.fromEntries(questions.map((q) => [q.id, byVideo[q.youtubeId]])));
  });

  /** One video, checked while a link is typed into the question form. */
  router.get('/videos/:youtubeId', async (req, res) => {
    const { youtubeId } = req.params;
    if (!YOUTUBE_ID.test(youtubeId)) throw new HttpError(400, 'Mã video không hợp lệ');
    res.json({ status: (await checkVideos([youtubeId]))[youtubeId] });
  });

  router.post('/sets', async (req, res) => {
    const name = cleanText(req.body?.name, 100);
    if (!name) throw new HttpError(400, 'Hãy nhập tên bộ đề');
    const set = await library.mutate((data) => {
      const now = new Date().toISOString();
      const created: QuestionSet = { id: newId(), name, createdAt: now, updatedAt: now, questions: [] };
      data.sets.push(created);
      return created;
    });
    res.json(toSetDto(set));
  });

  router.patch('/sets/:id', async (req, res) => {
    const name = cleanText(req.body?.name, 100);
    if (!name) throw new HttpError(400, 'Hãy nhập tên bộ đề');
    const set = await library.mutate((data) => {
      const target = findSet(data, req.params.id);
      target.name = name;
      target.updatedAt = new Date().toISOString();
      return target;
    });
    res.json(toSetDto(set));
  });

  router.delete('/sets/:id', async (req, res) => {
    await library.mutate((data) => {
      findSet(data, req.params.id).deletedAt = new Date().toISOString();
    });
    res.json({ ok: true });
  });

  router.post('/sets/:id/questions', upload.single('audio'), async (req: Request<{ id: string }>, res) => {
    const fields = readQuestionFields(req.body ?? {});
    if (!req.file) throw new HttpError(400, 'Hãy chọn file MP3');
    const audio = await saveAudio(req.file);
    const set = await library.mutate((data) => {
      const target = findSet(data, req.params.id);
      const now = new Date().toISOString();
      target.questions.push({ id: newId(), audio, createdAt: now, ...fields });
      target.updatedAt = now;
      return target;
    });
    res.json(toSetDto(set));
  });

  router.patch(
    '/sets/:id/questions/:qid',
    upload.single('audio'),
    async (req: Request<{ id: string; qid: string }>, res) => {
      const fields = readQuestionFields(req.body ?? {});
      const audio = req.file ? await saveAudio(req.file) : null;
      const set = await library.mutate((data) => {
        const target = findSet(data, req.params.id);
        const question = target.questions.find((q) => q.id === req.params.qid && !q.deletedAt);
        if (!question) throw new HttpError(404, 'Không tìm thấy câu hỏi');
        Object.assign(question, fields, audio ? { audio } : {});
        target.updatedAt = new Date().toISOString();
        return target;
      });
      res.json(toSetDto(set));
    },
  );

  router.delete('/sets/:id/questions/:qid', async (req, res) => {
    const set = await library.mutate((data) => {
      const target = findSet(data, req.params.id);
      const question = target.questions.find((q) => q.id === req.params.qid && !q.deletedAt);
      if (!question) throw new HttpError(404, 'Không tìm thấy câu hỏi');
      question.deletedAt = target.updatedAt = new Date().toISOString();
      return target;
    });
    res.json(toSetDto(set));
  });

  return router;
}
