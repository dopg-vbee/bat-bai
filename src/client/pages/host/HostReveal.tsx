import { SkipForward } from 'lucide-react';
import type { HostState } from '../../../shared/types.ts';
import { socket } from '../../lib/socket.ts';
import { AllCorrectCelebration } from './AllCorrectCelebration.tsx';

interface HostRevealProps {
  state: HostState;
  /** Receives the placeholder the pre-buffered video (HostClip) is drawn over. */
  onVideoSlot: (slot: HTMLElement | null) => void;
}

/** The answer and its clip, big and centred; the leaderboard follows once the clip ends. */
export function HostReveal({ state, onVideoSlot }: HostRevealProps) {
  function handleSkip() {
    socket.emit('host:next');
  }

  return (
    <section className="host-reveal">
      {state.allCorrect && <AllCorrectCelebration />}
      <p className="host-question-no">
        Câu {state.qIndex + 1}/{state.qTotal} · {state.correctFeed.length}/{state.players.length} người đoán đúng
      </p>
      <h2 className="reveal-title">{state.answer}</h2>
      {state.clip && <div className="video-slot" ref={onVideoSlot} />}
      <button className="btn btn-ghost icon-btn skip-btn" onClick={handleSkip} aria-label="Bỏ qua" title="Bỏ qua">
        <SkipForward />
      </button>
    </section>
  );
}
