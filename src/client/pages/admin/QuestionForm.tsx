import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { MAX_AUDIO_MB, type QuestionDto, type QuestionSetDto } from '../../../shared/types.ts';
import { formatTimestamp, parseTimestamp, parseYoutube, youtubeWatchUrl } from '../../../shared/youtube.ts';
import { YoutubeClip } from '../../components/YoutubeClip.tsx';
import { api } from '../../lib/api.ts';

interface QuestionFormProps {
  setId: string;
  question: QuestionDto | null;
  onSaved: (set: QuestionSetDto) => void;
  onCancel?: () => void;
}

export function QuestionForm({ setId, question, onSaved, onCancel }: QuestionFormProps) {
  const [title, setTitle] = useState(question?.title ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState(question?.youtubeUrl ?? '');
  const [start, setStart] = useState(question ? formatTimestamp(question.startSec) : '');
  const [end, setEnd] = useState(question?.endSec != null ? formatTimestamp(question.endSec) : '');
  const [file, setFile] = useState<File | null>(null);
  const [showClip, setShowClip] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const youtube = parseYoutube(youtubeUrl);
  const startSec = start.trim() ? parseTimestamp(start) : (youtube?.start ?? 0);
  const endSec = end.trim() ? parseTimestamp(end) : null;
  const endError = end.trim()
    ? endSec === null
      ? 'Ví dụ: 1:50 hoặc 110'
      : startSec !== null && endSec <= startSec
        ? 'Phải sau thời điểm bắt đầu'
        : ''
    : '';
  const rangeValid = youtube && startSec !== null && !endError;
  const ready = title.trim() && rangeValid && (file || question);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (picked && picked.size > MAX_AUDIO_MB * 1024 * 1024) {
      setError(`File quá lớn (tối đa ${MAX_AUDIO_MB}MB)`);
      event.target.value = '';
      return;
    }
    setError('');
    setFile(picked);
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setTitle(event.target.value);
  }

  function handleYoutubeChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setYoutubeUrl(value);
    // Fill the range from the link's ?t= / &end= so the host rarely has to type it.
    const parsed = parseYoutube(value);
    if (!parsed) return;
    setStart(formatTimestamp(parsed.start));
    if (parsed.end !== null) setEnd(formatTimestamp(parsed.end));
  }

  function handleStartChange(event: ChangeEvent<HTMLInputElement>) {
    setStart(event.target.value);
  }

  function handleEndChange(event: ChangeEvent<HTMLInputElement>) {
    setEnd(event.target.value);
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
    body.set('start', start);
    body.set('end', end);
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
        setStart('');
        setEnd('');
        setFile(null);
        setShowClip(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card question-form" onSubmit={handleSubmit}>
      <h3>{question ? `Sửa câu: ${question.title}` : '➕ Thêm câu hỏi'}</h3>
      <div className="form-grid">
        <label className="field">
          <span className="label">File MP3 {question && '(bỏ trống nếu giữ file cũ)'}</span>
          <input ref={fileRef} className="input input-sm" type="file" accept="audio/mpeg,.mp3" onChange={handleFileChange} />
        </label>
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
        </label>
        <div className="field-pair">
          <label className="field">
            <span className="label">Phát từ</span>
            <input className="input input-sm" placeholder="1:15" value={start} onChange={handleStartChange} />
            {startSec === null && <span className="error-text">Ví dụ: 1:15 hoặc 75</span>}
          </label>
          <label className="field">
            <span className="label">Đến (tùy chọn)</span>
            <input className="input input-sm" placeholder="1:45" value={end} onChange={handleEndChange} />
            {endError && <span className="error-text">{endError}</span>}
          </label>
        </div>
      </div>
      {youtube && startSec !== null && !endError && (
        <div className="clip-preview">
          <div className="clip-preview-actions">
            <button type="button" className="btn btn-ghost-dark btn-sm" onClick={handleToggleClip}>
              {showClip ? '✕ Đóng xem trước' : '▶ Xem trước đoạn YouTube'}
            </button>
            <a href={youtubeWatchUrl(youtube.id, startSec)} target="_blank" rel="noreferrer">
              Mở trên YouTube ↗
            </a>
          </div>
          {showClip && <YoutubeClip youtubeId={youtube.id} startSec={startSec} endSec={endSec} title={title || 'Xem trước'} />}
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>
            Hủy
          </button>
        )}
        <button className="btn btn-primary" disabled={!ready || busy}>
          {busy ? 'Đang lưu…' : question ? 'Lưu thay đổi' : 'Thêm câu hỏi'}
        </button>
      </div>
    </form>
  );
}
