import { CircleCheck, Volume2 } from 'lucide-react';
import type { HostState } from '../../../shared/types.ts';
import { EmojiText } from '../../components/Emoji.tsx';
import { DoubleTag, LuckyBanner } from '../../components/Luck.tsx';
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
  // Team play counts teams: a team is in once any of its members got it.
  const teamPlay = state.teamMode !== 'off';
  const online = state.players.filter((p) => p.connected).length;
  const correct = teamPlay ? new Set(state.correctFeed.map((e) => e.team)).size : state.correctFeed.length;
  const total = teamPlay ? state.teams.length : online;

  if (now < state.startsAt) {
    return (
      <section className="host-center">
        <p className="host-question-no">
          Câu {state.qIndex + 1}/{state.qTotal}
        </p>
        <div className="countdown-number countdown-xl" key={Math.ceil((state.startsAt - now) / 1000)}>
          {Math.ceil((state.startsAt - now) / 1000)}
        </div>
        {state.double ? <LuckyBanner large /> : <p className="host-sub">Lắng nghe thật kỹ nhé…</p>}
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
        {state.double && <DoubleTag />}
        {state.correctFeed.length ? (
          <>
            <p className="stats-count">
              <CircleCheck />
              <strong>{correct}</strong>
              <span>/{total}</span>
            </p>
            <p className="stats-label">{teamPlay ? 'đội đã đoán đúng' : 'người đã đoán đúng'}</p>
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
