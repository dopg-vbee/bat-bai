import { CircleCheck, Volume2 } from 'lucide-react';
import type { HostState } from '../../../shared/types.ts';
import { EmojiText } from '../../components/Emoji.tsx';
import { Equalizer } from '../../components/Equalizer.tsx';
import { TimerRing } from '../../components/TimerRing.tsx';
import { useServerNow } from '../../lib/socket.ts';
import { CorrectWall } from './CorrectWall.tsx';
import type { QuestionAudio } from './useQuestionAudio.ts';

export function HostQuestion({ state, audio }: { state: HostState; audio: QuestionAudio }) {
  // While paused the clock stands still at the moment the host paused.
  const live = useServerNow(!state.pausedAt, 100);
  const now = state.pausedAt || live;
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
      <CorrectWall feed={state.correctFeed}>
        <div className="host-question-main">
          <p className="host-question-no">
            Câu {state.qIndex + 1}/{state.qTotal}
          </p>
          <TimerRing remainingMs={state.endsAt - now} totalMs={state.durationMs} size={220} />
          <Equalizer playing={audio.playing} />
          <h2 className="host-prompt">Bài hát này tên gì?</h2>
          <p className="host-progress">
            {state.correctFeed.length ? (
              <>
                <CircleCheck /> <strong>{state.correctFeed.length}</strong>/{online} người đã đoán đúng
              </>
            ) : (
              <EmojiText text="Chưa ai đoán ra… 🤔" />
            )}
          </p>
          {/* Only when the browser blocked autoplay: without it the round would have no sound. */}
          {audio.blocked && (
            <button className="btn btn-primary btn-lg" onClick={audio.replay}>
              <Volume2 /> Bấm để phát nhạc
            </button>
          )}
        </div>
      </CorrectWall>
    </section>
  );
}
