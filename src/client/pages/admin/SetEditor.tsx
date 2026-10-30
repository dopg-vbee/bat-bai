import { Globe, GripVertical, Lock, Pencil, Play, RefreshCw, Shuffle, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { QuestionDto, QuestionSetDto, VideoStatus } from '../../../shared/types.ts';
import { shuffled } from '../../../shared/shuffle.ts';
import { formatRange } from '../../../shared/youtube.ts';
import { YoutubeClip } from '../../components/YoutubeClip.tsx';
import { api } from '../../lib/api.ts';
import { CreateRoomPanel } from './CreateRoomPanel.tsx';
import { QuestionForm } from './QuestionForm.tsx';
import { VideoProblem } from './VideoProblem.tsx';

/** "Trộn thứ tự" can be pressed again after this long. */
const SHUFFLE_COOLDOWN_MS = 1000;

interface SetEditorProps {
  set: QuestionSetDto;
  onChange: (set: QuestionSetDto) => void;
  onDeleted: (id: string) => void;
}

interface QuestionRowProps {
  index: number;
  question: QuestionDto;
  videoStatus: VideoStatus | undefined;
  onEdit: (id: string) => void;
  onDelete: (question: QuestionDto) => void;
  dragging: boolean;
  /** Where the dragged question would land, relative to this row. */
  dropMark: 'above' | 'below' | null;
  onDragStart: (id: string) => void;
  /** `slot`: the index the dragged question would be inserted before. */
  onDragOver: (slot: number) => void;
  onDragEnd: () => void;
}

function QuestionRow({
  index,
  question,
  videoStatus,
  onEdit,
  onDelete,
  dragging,
  dropMark,
  onDragStart,
  onDragOver,
  onDragEnd,
}: QuestionRowProps) {
  const [showClip, setShowClip] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);

  // Only the handle starts a drag (the rest of the row has buttons and an audio player),
  // but the whole row is what follows the pointer.
  function handleDragStart(event: DragEvent<HTMLSpanElement>) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', question.id);
    if (rowRef.current) event.dataTransfer.setDragImage(rowRef.current, 24, 24);
    onDragStart(question.id);
  }
  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    onDragOver(event.clientY > box.top + box.height / 2 ? index + 1 : index);
  }

  function handleToggleClip() {
    setShowClip((shown) => !shown);
  }
  function handleEdit() {
    onEdit(question.id);
  }
  function handleDelete() {
    onDelete(question);
  }
  return (
    <li
      ref={rowRef}
      className={`question-row${dragging ? ' dragging' : ''}${dropMark ? ` drop-${dropMark}` : ''}`}
      onDragOver={handleDragOver}
    >
      <span
        className="question-index"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        title="Kéo để đổi vị trí"
      >
        <GripVertical /> {index + 1}
      </span>
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
  // The list stays put while dragging (moving the dragged row in the DOM cancels the drag);
  // a marker shows where it will land.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const dragFrom = set.questions.findIndex((q) => q.id === draggingId);
  // Right above or below itself is no move: no marker there.
  const moveTo = dropSlot === null || dropSlot === dragFrom || dropSlot === dragFrom + 1 ? null : dropSlot;
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

  // Public sets can be picked by anyone who opens a room from the home page.
  function handleTogglePublic() {
    void run(async () => {
      const body = JSON.stringify({ public: !set.public });
      onChange(await api<QuestionSetDto>(`/sets/${set.id}/public`, { method: 'PUT', body }));
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

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(slot: number) {
    if (draggingId) setDropSlot(slot);
  }

  function handleListDragOver(event: DragEvent<HTMLOListElement>) {
    if (draggingId) event.preventDefault(); // allow dropping anywhere on the list, gaps included
  }

  function handleDrop(event: DragEvent<HTMLOListElement>) {
    event.preventDefault();
    if (moveTo === null) return;
    const moved = set.questions[dragFrom];
    const questions = set.questions.filter((q) => q !== moved);
    questions.splice(moveTo > dragFrom ? moveTo - 1 : moveTo, 0, moved);
    saveOrder(questions);
  }

  function handleShuffle() {
    saveOrder(shuffled(set.questions));
    setShuffling(true);
    setTimeout(() => setShuffling(false), SHUFFLE_COOLDOWN_MS);
  }

  /** Shows the new order at once and saves it; puts the old one back if saving fails. */
  function saveOrder(questions: QuestionDto[]) {
    const before = set;
    onChange({ ...set, questions });
    void run(async () => {
      try {
        const body = JSON.stringify({ order: questions.map((q) => q.id) });
        onChange(await api<QuestionSetDto>(`/sets/${set.id}/order`, { method: 'PUT', body }));
      } catch (err) {
        onChange(before);
        throw err;
      }
    });
  }

  // Fires after a drop too, and when the drag is cancelled (Esc, dropped outside the list).
  function handleDragEnd() {
    setDraggingId(null);
    setDropSlot(null);
  }

  function handleSaved(updated: QuestionSetDto) {
    onChange(updated);
    setEditingId(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  return (
    // Wide screens: the set, room and question form on the left, the list beside them (see .set-editor).
    <div className="set-editor">
      <div className="set-editor-side">
        <div className="card set-header">
          <div>
            <h2>{set.name}</h2>
            <p className="muted">{set.questions.length} câu hỏi</p>
          </div>
          <div className="set-header-actions">
            <button
              className="btn btn-ghost-dark btn-sm"
              onClick={handleTogglePublic}
              title={set.public ? 'Đang cho mọi người mở phòng với bộ này: bấm để ẩn' : 'Cho mọi người mở phòng với bộ này'}
            >
              {set.public ? <Globe /> : <Lock />} {set.public ? 'Công khai' : 'Riêng tư'}
            </button>
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
      </div>

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
          <button
            className="btn btn-ghost-dark btn-sm"
            onClick={handleShuffle}
            disabled={shuffling || set.questions.length < 2}
            title="Xáo thứ tự các câu và lưu luôn: phòng chơi theo đúng thứ tự này"
          >
            <Shuffle /> Trộn thứ tự
          </button>
          <button className="btn btn-ghost-dark btn-sm" onClick={handleRecheckVideos} disabled={checkingVideos}>
            <RefreshCw /> Kiểm tra video
          </button>
        </div>
        {set.questions.length === 0 && <p className="muted">Chưa có câu nào. Thêm câu đầu tiên ở trên nhé!</p>}
        <ol className="question-list" onDragOver={handleListDragOver} onDrop={handleDrop}>
          {set.questions.map((question, i) => (
            <QuestionRow
              key={question.id}
              index={i}
              question={question}
              videoStatus={videos[question.id]}
              onEdit={setEditingId}
              onDelete={handleDeleteQuestion}
              dragging={question.id === draggingId}
              dropMark={moveTo === i ? 'above' : moveTo === i + 1 && i === set.questions.length - 1 ? 'below' : null}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
