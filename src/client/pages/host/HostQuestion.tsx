import type { HostState } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Equalizer } from '../../components/Equalizer.tsx';
import { TimerRing } from '../../components/TimerRing.tsx';
import { socket, useServerNow } from '../../lib/socket.ts';
import type { QuestionAudio } from './useQuestionAudio.ts';

const FEED_SIZE = 14;

export function HostQuestion({ state, audio }: { state: HostState; audio: QuestionAudio }) {
  const now = useServerNow(true, 100);
  const online = state.players.filter((p) => p.connected).length;
  const feed = state.correctFeed.slice(-FEED_SIZE).reverse();

  function handleReveal() {
    socket.emit('host:reveal');
  }

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
      <div className="host-question-main">
        <p className="host-question-no">
          Câu {state.qIndex + 1}/{state.qTotal}
        </p>
        <TimerRing remainingMs={state.endsAt - now} totalMs={state.durationMs} size={220} />
        <Equalizer playing={audio.playing} />
        <h2 className="host-prompt">Bài hát này tên gì?</h2>
        <p className="host-progress">
          ✅ <strong>{state.correctFeed.length}</strong>/{online} người đã đoán đúng
        </p>
        <div className="host-actions">
          {audio.blocked ? (
            <button className="btn btn-primary btn-lg" onClick={audio.replay}>
              🔊 Bấm để phát nhạc
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={audio.replay}>
              🔁 Phát lại
            </button>
          )}
          <button className="btn btn-ghost" onClick={handleReveal}>
            ⏭ Hiện đáp án
          </button>
        </div>
      </div>
      <aside className="host-feed">
        <h3>Đoán đúng</h3>
        {feed.length === 0 && <p className="muted-light">Chưa ai đoán ra… 🤔</p>}
        <ul>
          {feed.map((entry) => (
            <li key={entry.id} className="feed-item">
              <Avatar avatar={entry.avatar} color={entry.color} size="sm" />
              <span className="feed-name">{entry.name}</span>
              <span className="feed-points">+{entry.points}</span>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
