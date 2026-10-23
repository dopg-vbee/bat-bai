import { ListMusic, Plus } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { QuestionSetDto } from '../../../shared/types.ts';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { api } from '../../lib/api.ts';
import { Link, navigate } from '../../lib/router.tsx';
import { AdminHeader } from './AdminHeader.tsx';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function SetCard({ set }: { set: QuestionSetDto }) {
  return (
    <li>
      <Link to={`/admin/sets/${set.id}`} className="card set-card">
        <span className="set-card-icon">
          <ListMusic />
        </span>
        <strong className="set-card-name">{set.name}</strong>
        <span className="set-card-meta">
          {set.questions.length} câu · sửa {formatDate(set.updatedAt)}
        </span>
      </Link>
    </li>
  );
}

export function SetListPage({ onLogout }: { onLogout: () => void }) {
  const [sets, setSets] = useState<QuestionSetDto[] | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<QuestionSetDto[]>('/sets')
      .then(setSets)
      .catch((err: Error) => setError(err.message));
  }, []);

  function handleNewNameChange(event: ChangeEvent<HTMLInputElement>) {
    setNewName(event.target.value);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const created = await api<QuestionSetDto>('/sets', { method: 'POST', body: JSON.stringify({ name: newName }) });
      navigate(`/admin/sets/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="screen admin-screen">
      <AdminHeader title="Bộ đề" onLogout={onLogout} />
      {error && <div className="banner">{error}</div>}
      <form className="card create-set" onSubmit={handleCreate}>
        <input
          className="input"
          placeholder="Tên bộ đề mới, ví dụ: Nhạc Việt 2024"
          value={newName}
          maxLength={100}
          onChange={handleNewNameChange}
        />
        <button className="btn btn-primary btn-lg" disabled={!newName.trim() || busy}>
          <Plus /> Tạo bộ đề
        </button>
      </form>
      {sets === null && !error && <div className="spinner" />}
      {sets?.length === 0 && (
        <div className="card empty-state">
          <StatusBadge icon={ListMusic} />
          <p>Chưa có bộ đề nào. Tạo bộ đề đầu tiên ở trên nhé!</p>
        </div>
      )}
      <ul className="set-grid">
        {sets?.map((set) => (
          <SetCard key={set.id} set={set} />
        ))}
      </ul>
    </main>
  );
}
