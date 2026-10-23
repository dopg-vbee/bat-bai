import { Pause, Play } from 'lucide-react';

/** Covers the big screen (video included) while the host has paused the game. */
export function PauseOverlay({ onResume }: { onResume: () => void }) {
  return (
    <div className="pause-overlay" role="dialog" aria-label="Trò chơi đang tạm dừng">
      <span className="pause-icon">
        <Pause strokeWidth={2.5} />
      </span>
      <h2 className="pause-title">Tạm dừng</h2>
      <button className="btn btn-primary btn-xl" onClick={onResume} autoFocus>
        <Play /> Tiếp tục
      </button>
    </div>
  );
}
