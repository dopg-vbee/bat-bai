import { Eye, Pencil, Play, RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DEFAULT_DURATION_SEC,
  type QuestionDto,
  type QuestionSetDto,
  type VideoStatus,
} from '../../../shared/types.ts';
import { formatRange } from '../../../shared/youtube.ts';
import { YoutubeClip } from '../../components/YoutubeClip.tsx';
import { api } from '../../lib/api.ts';
import { createRoom } from '../../lib/rooms.ts';
import { CreateRoomPanel } from './CreateRoomPanel.tsx';
import { QuestionForm } from './QuestionForm.tsx';
import { VideoProblem } from './VideoProblem.tsx';

interface SetEditorProps {
  set: QuestionSetDto;
  onChange: (set: QuestionSetDto) => void;
  onDeleted: (id: string) => void;
}

interface QuestionRowProps {
  index: number;
  question: QuestionDto;
  videoStatus: VideoStatus | undefined;
  onPreview: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (question: QuestionDto) => void;
}

function QuestionRow({ index, question, videoStatus, onPreview, onEdit, onDelete }: QuestionRowProps) {
  const [showClip, setShowClip] = useState(false);

  function handleToggleClip() {
    setShowClip((shown) => !shown);
  }
  function handlePreview() {
    onPreview(question.id);
  }
  function handleEdit() {
    onEdit(question.id);
  }
  function handleDelete() {
    onDelete(question);
  }
  return (
    <li className="question-row">
      <span className="question-index">{index + 1}</span>
      <div className="question-info">
        <strong>{question.title}</strong>
        <button type="button" className="link-button" onClick={handleToggleClip}>
          {showClip ? <X /> : <Play />}
          {showClip ? 'Đóng' : 'YouTube'} {formatRange(question.startSec, question.endSec)}
        </button>
        <VideoProblem status={videoStatus} />
      </div>
      <audio className="question-audio" controls preload="none" src={question.audioUrl} />
      <div className="question-actions">
        <button className="btn btn-ghost-dark btn-sm" onClick={handlePreview} title="Xem câu này như khi chơi thật">
          <Eye /> Xem thử
        </button>
        <button className="btn btn-ghost-dark btn-sm" onClick={handleEdit}>
          <Pencil /> Sửa
        </button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          <Trash2 /> Xóa
        </button>
      </div>
      {showClip && (
        <div className="question-clip">
          <YoutubeClip
            youtubeId={question.youtubeId}
            startSec={question.startSec}
            endSec={question.endSec}
            title={question.title}
          />
        </div>
      )}
    </li>
  );
}

export function SetEditor({ set, onChange, onDeleted }: SetEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [videos, setVideos] = useState<Record<string, VideoStatus>>({});
  const [checkingVideos, setCheckingVideos] = useState(false);
  const editing = set.questions.find((q) => q.id === editingId) ?? null;
  const brokenVideos = set.questions.filter((q) => videos[q.id] === 'blocked' || videos[q.id] === 'missing').length;
  // Re-checked whenever a question is added, removed or gets another video.
  const videoKey = set.questions.map((q) => `${q.id}:${q.youtubeId}`).join();

  async function loadVideos(fresh: boolean) {
    setCheckingVideos(true);
    try {
      setVideos(await api<Record<string, VideoStatus>>(`/sets/${set.id}/videos${fresh ? '?fresh=1' : ''}`));
    } catch {
      // Keep the previous badges; the button can try again.
    } finally {
      setCheckingVideos(false);
    }
  }

  useEffect(() => {
    void loadVideos(false);
  }, [set.id, videoKey]);

  function handleRecheckVideos() {
    void loadVideos(true);
  }

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleRename() {
    const name = prompt('Tên mới cho bộ đề', set.name)?.trim();
    if (!name || name === set.name) return;
    void run(async () => {
      onChange(await api<QuestionSetDto>(`/sets/${set.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }));
    });
  }

  function handleDeleteSet() {
    if (!confirm(`Xóa bộ đề "${set.name}"? (Dữ liệu vẫn được giữ trong bản sao lưu)`)) return;
    void run(async () => {
      await api(`/sets/${set.id}`, { method: 'DELETE' });
      onDeleted(set.id);
    });
  }

  function handleDeleteQuestion(question: QuestionDto) {
    if (!confirm(`Xóa câu "${question.title}"?`)) return;
    void run(async () => {
      onChange(await api<QuestionSetDto>(`/sets/${set.id}/questions/${question.id}`, { method: 'DELETE' }));
    });
  }

  function handlePreviewQuestion(questionId: string) {
    void run(async () => {
      const failure = await createRoom({
        setId: set.id,
        questionId,
        durationSec: DEFAULT_DURATION_SEC,
        shuffle: false,
        preview: true,
      });
      if (failure) throw new Error(failure);
    });
  }

  function handleSaved(updated: QuestionSetDto) {
    onChange(updated);
    setEditingId(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  return (
    <div className="stack">
      <div className="card set-header">
        <div>
          <h2>{set.name}</h2>
          <p className="muted">{set.questions.length} câu hỏi</p>
        </div>
        <div className="set-header-actions">
          <button className="btn btn-ghost-dark btn-sm" onClick={handleRename}>
            <Pencil /> Đổi tên
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteSet}>
            <Trash2 /> Xóa bộ đề
          </button>
        </div>
      </div>

      <CreateRoomPanel set={set} brokenVideos={brokenVideos} />

      {error && <p className="error-text">{error}</p>}

      <QuestionForm
        key={editing?.id ?? 'new'}
        setId={set.id}
        question={editing}
        onSaved={handleSaved}
        onCancel={editing ? handleCancelEdit : undefined}
      />

      <div className="card">
        <div className="question-list-head">
          <h3>Danh sách câu hỏi</h3>
          <span className="muted">
            {checkingVideos
              ? 'Đang kiểm tra video…'
              : brokenVideos
                ? `${brokenVideos} câu có video lỗi`
                : 'Video đều phát được'}
          </span>
          <button className="btn btn-ghost-dark btn-sm" onClick={handleRecheckVideos} disabled={checkingVideos}>
            <RefreshCw /> Kiểm tra video
          </button>
        </div>
        {set.questions.length === 0 && <p className="muted">Chưa có câu nào. Thêm câu đầu tiên ở trên nhé!</p>}
        <ol className="question-list">
          {set.questions.map((question, i) => (
            <QuestionRow
              key={question.id}
              index={i}
              question={question}
              videoStatus={videos[question.id]}
              onPreview={handlePreviewQuestion}
              onEdit={setEditingId}
              onDelete={handleDeleteQuestion}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
