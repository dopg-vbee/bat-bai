import type { HostState } from '../../../shared/types.ts';
import { Leaderboard } from '../../components/Leaderboard.tsx';
import { socket } from '../../lib/socket.ts';

interface HostRevealProps {
  state: HostState;
  /** Receives the placeholder the pre-buffered video (HostClip) is drawn over. */
  onVideoSlot: (slot: HTMLElement | null) => void;
}

export function HostReveal({ state, onVideoSlot }: HostRevealProps) {
  const isLast = state.qIndex + 1 >= state.qTotal;
  const correct = state.correctFeed.length;

  function handleNext() {
    socket.emit('host:next');
  }

  return (
    <section className="host-reveal">
      <div className="reveal-main">
        <p className="host-question-no">
          Câu {state.qIndex + 1}/{state.qTotal} · {correct}/{state.players.length} người đoán đúng
        </p>
        <h2 className="reveal-title">{state.answer}</h2>
        {state.clip && (
          <div className="video-slot" ref={onVideoSlot}>
            <div className="video-slot-frame" />
            <div className="video-slot-bar" />
          </div>
        )}
      </div>
      <div className="reveal-side">
        <h3>Bảng xếp hạng</h3>
        <Leaderboard rows={state.leaderboard} />
        <button className="btn btn-primary btn-xl" onClick={handleNext}>
          {isLast ? '🏆 Xem kết quả' : 'Câu tiếp ▶'}
        </button>
      </div>
    </section>
  );
}
