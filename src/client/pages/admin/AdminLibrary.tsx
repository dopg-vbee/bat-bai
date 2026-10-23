import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { QuestionSetDto } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';
import { SetEditor } from './SetEditor.tsx';

function SetListItem({ set, active, onSelect }: { set: QuestionSetDto; active: boolean; onSelect: (id: string) => void }) {
  function handleClick() {
    onSelect(set.id);
  }
  return (
    <li>
      <button className={`set-item${active ? ' active' : ''}`} onClick={handleClick}>
        <span className="set-item-name">{set.name}</span>
        <span className="set-item-count">{set.questions.length} câu</span>
      </button>
    </li>
  );
}

export function AdminLibrary({ onLogout }: { onLogout: () => void }) {
  const [sets, setSets] = useState<QuestionSetDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<QuestionSetDto[]>('/sets')
      .then((list) => {
        setSets(list);
        setSelectedId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  function handleNewNameChange(event: ChangeEvent<HTMLInputElement>) {
    setNewName(event.target.value);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    try {
      const created = await api<QuestionSetDto>('/sets', { method: 'POST', body: JSON.stringify({ name: newName }) });
      setSets((list) => [...(list ?? []), created]);
      setSelectedId(created.id);
      setNewName('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleSetChange(updated: QuestionSetDto) {
    setSets((list) => list?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
  }

  function handleSetDeleted(id: string) {
    setSets((list) => list?.filter((s) => s.id !== id) ?? null);
    setSelectedId(null);
  }

  const selected = sets?.find((s) => s.id === selectedId) ?? null;

  return (
    <main className="screen admin-screen">
      <header className="admin-bar">
        <span className="host-brand">Bắt Bài 🎤</span>
        <span className="admin-bar-title">Quản lý câu hỏi</span>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>
          Đăng xuất
        </button>
      </header>
      {error && <div className="banner">{error}</div>}
      <div className="admin-layout">
        <aside className="card admin-sets">
          <h3>Bộ đề</h3>
          {sets === null && !error && <div className="spinner spinner-dark" />}
          <ul className="set-list">
            {sets?.map((set) => (
              <SetListItem key={set.id} set={set} active={set.id === selectedId} onSelect={setSelectedId} />
            ))}
          </ul>
          <form className="inline-form" onSubmit={handleCreate}>
            <input
              className="input input-sm"
              placeholder="Tên bộ đề mới"
              value={newName}
              maxLength={100}
              onChange={handleNewNameChange}
            />
            <button className="btn btn-primary btn-sm" disabled={!newName.trim()}>
              + Tạo
            </button>
          </form>
        </aside>
        <section className="admin-main">
          {selected ? (
            <SetEditor key={selected.id} set={selected} onChange={handleSetChange} onDeleted={handleSetDeleted} />
          ) : (
            <div className="card empty-state">
              <div className="emoji-xl">🎵</div>
              <p>{sets?.length ? 'Chọn một bộ đề bên trái' : 'Tạo bộ đề đầu tiên để bắt đầu thêm câu hỏi'}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
