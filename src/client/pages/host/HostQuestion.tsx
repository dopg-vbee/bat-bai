import { CircleCheck, Volume2 } from 'lucide-react';
import type { HostState } from '../../../shared/types.ts';
import { EmojiText } from '../../components/Emoji.tsx';
import { Equalizer } from '../../components/Equalizer.tsx';
import { TimerRing } from '../../components/TimerRing.tsx';
import { useServerNow } from '../../lib/socket.ts';
import { CorrectStream, useScreenUnit } from './CorrectStream.tsx';
import { WrongList } from './WrongList.tsx';
import type { QuestionAudio } from './useQuestionAudio.ts';

const TIMER_SIZE = 240;

/**
 * Question screen as a grid: wrong guesses | timer + prompt | progress on top, the row of
 * correct answers across the full width below, filling whatever height is left.
 */
export function HostQuestion({ state, audio }: { state: HostState; audio: QuestionAudio }) {
  // While paused the clock stands still at the moment the host paused.
  const live = useServerNow(!state.pausedAt, 100);
  const now = state.pausedAt || live;
  const unit = useScreenUnit();
  const online = state.players.filter((p) => p.connected).length;

  if (now < state.startsAt) {
    return (
      <section className="host-center">
        <p className="host-question-no">
          Câu {state.qIndex + 1}/{state.qTotal}
        </p>
        <div className="countdown-number countdown-xl" key={Math.ceil((state.startsAt - now) / 1000)}>
          {Math.ceil((state.startsAt - now) / 1000)}
        </div>
        <p className="host-sub">Lắng nghe thật kỹ nhé…</p>
      </section>
    );
  }

  return (
    <section className="host-question">
      <WrongList entries={state.wrongFeed} />
      <div className="host-question-main">
        <TimerRing remainingMs={state.endsAt - now} totalMs={state.durationMs} size={Math.round(TIMER_SIZE * unit)} />
        <Equalizer playing={audio.playing} />
        <h2 className="host-prompt">Bài hát này tên gì?</h2>
        {/* Only when the browser blocked autoplay: without it the round would have no sound. */}
        {audio.blocked && (
          <button className="btn btn-primary btn-lg" onClick={audio.replay}>
            <Volume2 /> Bấm để phát nhạc
          </button>
        )}
      </div>
      <aside className="question-stats">
        <p className="host-question-no">
          Câu {state.qIndex + 1}/{state.qTotal}
        </p>
        {state.correctFeed.length ? (
          <>
            <p className="stats-count">
              <CircleCheck />
              <strong>{state.correctFeed.length}</strong>
              <span>/{online}</span>
            </p>
            <p className="stats-label">người đã đoán đúng</p>
          </>
        ) : (
          <p className="stats-label">
            <EmojiText text="Chưa ai đoán ra… 🤔" />
          </p>
        )}
      </aside>
      <CorrectStream entries={state.correctFeed} />
    </section>
  );
}
