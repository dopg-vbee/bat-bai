import { ExternalLink, Pencil, Play, Plus, Save, X } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { QuestionDto, QuestionSetDto } from '../../../shared/types.ts';
import { parseYoutube, youtubeWatchUrl } from '../../../shared/youtube.ts';
import { YoutubeClip } from '../../components/YoutubeClip.tsx';
import { api } from '../../lib/api.ts';
import { useYoutubeDuration } from '../../lib/youtubeApi.ts';
import { AudioDropzone } from './AudioDropzone.tsx';
import { ClipRangeEditor } from './ClipRangeEditor.tsx';
import { useVideoStatus, VideoProblem } from './VideoProblem.tsx';

interface QuestionFormProps {
  setId: string;
  question: QuestionDto | null;
  onSaved: (set: QuestionSetDto) => void;
  onCancel?: () => void;
}

const PREVIEW_DEBOUNCE_MS = 400;

/** Lets slider drags settle before the preview player seeks again. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function QuestionForm({ setId, question, onSaved, onCancel }: QuestionFormProps) {
  const [title, setTitle] = useState(question?.title ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState(question?.youtubeUrl ?? '');
  const [startSec, setStartSec] = useState(question?.startSec ?? 0);
  const [endSec, setEndSec] = useState<number | null>(question?.endSec ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [showClip, setShowClip] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const youtube = parseYoutube(youtubeUrl);
  const duration = useYoutubeDuration(youtube?.id ?? null);
  const videoStatus = useVideoStatus(youtube?.id ?? null);
  const previewStart = useDebounced(startSec, PREVIEW_DEBOUNCE_MS);
  const previewEnd = useDebounced(endSec, PREVIEW_DEBOUNCE_MS);
  const ready = title.trim() && youtube && (endSec === null || endSec > startSec) && (file || question);

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setTitle(event.target.value);
  }

  function handleYoutubeChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setYoutubeUrl(value);
    // Take the range from the link's ?t= / &end= so the host rarely has to set it.
    const parsed = parseYoutube(value);
    if (!parsed) return;
    setStartSec(parsed.start);
    setEndSec(parsed.end);
  }

  function handleRangeChange(start: number, end: number | null) {
    setStartSec(start);
    setEndSec(end);
  }

  function handleToggleClip() {
    setShowClip((shown) => !shown);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    const body = new FormData();
    body.set('title', title);
    body.set('youtubeUrl', youtubeUrl);
    body.set('start', String(startSec));
    body.set('end', endSec === null ? '' : String(endSec));
    if (file) body.set('audio', file);
    setBusy(true);
    setError('');
    try {
      const path = question ? `/sets/${setId}/questions/${question.id}` : `/sets/${setId}/questions`;
      const updated = await api<QuestionSetDto>(path, { method: question ? 'PATCH' : 'POST', body });
      onSaved(updated);
      if (!question) {
        setTitle('');
        setYoutubeUrl('');
        setStartSec(0);
        setEndSec(null);
        setFile(null);
        setShowClip(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card question-form" onSubmit={handleSubmit}>
      <h3 className="icon-heading">
        {question ? <Pencil /> : <Plus />}
        {question ? `Sửa câu: ${question.title}` : 'Thêm câu hỏi'}
      </h3>
      <AudioDropzone file={file} note={question ? 'bỏ trống nếu giữ file cũ' : undefined} onChange={setFile} />
      <div className="form-grid">
        <label className="field">
          <span className="label">Tên bài hát (đáp án)</span>
          <input
            className="input input-sm"
            placeholder="Ví dụ: Lạc Trôi"
            value={title}
            maxLength={200}
            onChange={handleTitleChange}
          />
        </label>
        <label className="field">
          <span className="label">Link YouTube</span>
          <input
            className="input input-sm"
            placeholder="https://youtu.be/...?t=75"
            value={youtubeUrl}
            onChange={handleYoutubeChange}
          />
          {youtubeUrl && !youtube && <span className="error-text">Link YouTube không hợp lệ</span>}
          <VideoProblem status={videoStatus} />
        </label>
      </div>
      {youtube && (
        <div className="clip-preview">
          <span className="label">Đoạn YouTube phát khi công bố đáp án</span>
          <ClipRangeEditor duration={duration} startSec={startSec} endSec={endSec} onChange={handleRangeChange} />
          <div className="clip-preview-actions">
            <button type="button" className="btn btn-ghost-dark btn-sm" onClick={handleToggleClip}>
              {showClip ? <X /> : <Play />}
              {showClip ? 'Đóng xem trước' : 'Xem trước đoạn YouTube'}
            </button>
            <a href={youtubeWatchUrl(youtube.id, startSec)} target="_blank" rel="noreferrer">
              Mở trên YouTube <ExternalLink />
            </a>
          </div>
          {showClip && (
            <YoutubeClip youtubeId={youtube.id} startSec={previewStart} endSec={previewEnd} title={title || 'Xem trước'} />
          )}
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>
            <X /> Hủy
          </button>
        )}
        <button className="btn btn-primary" disabled={!ready || busy}>
          {!busy && (question ? <Save /> : <Plus />)}
          {busy ? 'Đang lưu…' : question ? 'Lưu thay đổi' : 'Thêm câu hỏi'}
        </button>
      </div>
    </form>
  );
}
