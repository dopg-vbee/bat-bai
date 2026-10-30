import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { PublicSetDto } from '../../shared/types.ts';
import { OwnerNameForm } from './OwnerNameForm.tsx';

function SetButton({ set, onPick }: { set: PublicSetDto; onPick: (set: PublicSetDto) => void }) {
  function handlePick() {
    onPick(set);
  }

  return (
    <button type="button" className="home-set" onClick={handlePick}>
      <span className="home-set-name">{set.name}</span>
      <span className="home-set-count">{set.questionCount} câu</span>
      <ArrowRight />
    </button>
  );
}

/** The public sets: pick one, then give a name to open a room with it. */
export function SetBrowser({ sets }: { sets: PublicSetDto[] }) {
  const [picked, setPicked] = useState<PublicSetDto | null>(null);

  function handleBack() {
    setPicked(null);
  }

  if (picked) {
    return (
      <div className="set-browser">
        <OwnerNameForm set={picked} />
        <button type="button" className="btn btn-ghost" onClick={handleBack}>
          <ArrowLeft /> Chọn bộ đề khác
        </button>
      </div>
    );
  }

  return (
    <section className="card stack set-browser">
      <h2>Khám phá bộ đề</h2>
      <p className="muted">Chọn một bộ đề để mở phòng và rủ bạn bè vào chơi.</p>
      <div className="home-sets">
        {sets.map((set) => (
          <SetButton key={set.id} set={set} onPick={setPicked} />
        ))}
      </div>
    </section>
  );
}
