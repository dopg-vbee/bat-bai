import { ArrowLeft, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { QuestionSetDto } from '../../../shared/types.ts';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { api } from '../../lib/api.ts';
import { Link, navigate } from '../../lib/router.tsx';
import { AdminHeader } from './AdminHeader.tsx';
import { SetEditor } from './SetEditor.tsx';

export function SetPage({ setId, onLogout }: { setId: string; onLogout: () => void }) {
  const [set, setSet] = useState<QuestionSetDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<QuestionSetDto>(`/sets/${setId}`)
      .then(setSet)
      .catch((err: Error) => setError(err.message));
  }, [setId]);

  function handleDeleted() {
    navigate('/admin');
  }

  return (
    <main className="screen admin-screen">
      <AdminHeader title={set?.name ?? 'Bộ đề'} onLogout={onLogout} />
      <Link to="/admin" className="link-subtle back-link">
        <ArrowLeft /> Tất cả bộ đề
      </Link>
      {error && (
        <div className="card empty-state">
          <StatusBadge icon={SearchX} tone="danger" />
          <p>{error}</p>
        </div>
      )}
      {!set && !error && <div className="spinner" />}
      {set && <SetEditor set={set} onChange={setSet} onDeleted={handleDeleted} />}
    </main>
  );
}
