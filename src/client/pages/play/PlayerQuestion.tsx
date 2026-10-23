import { Send } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { PlayerState } from '../../../shared/types.ts';
import { AnimatedEmoji, EmojiText } from '../../components/Emoji.tsx';
import { burst } from '../../lib/confetti.ts';
import { socket, useServerNow } from '../../lib/socket.ts';

type Feedback = { kind: 'wrong' | 'info'; text: string } | null;

const SHAKE = [0, -10, 10, -8, 8, 0].map((x) => ({ transform: `translateX(${x}px)` }));

export function PlayerQuestion({ state }: { state: PlayerState }) {
  // While paused the clock stands still at the moment the host paused.
  const live = useServerNow(!state.pausedAt, 100);
  const now = state.pausedAt || live;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [earned, setEarned] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleTextChange(event: ChangeEvent<HTMLInputElement>) {
    setText(event.target.value);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const guess = text.trim();
    if (!guess || sending) return;
    setSending(true);
    try {
      const res = await socket.timeout(5000).emitWithAck('player:guess', guess);
      if (res.status === 'correct') {
        setEarned(res.points);
        burst();
      } else if (res.status === 'wrong') {
        setFeedback({ kind: 'wrong', text: 'Chưa đúng rồi, thử lại!' });
        inputRef.current?.animate(SHAKE, { duration: 400 });
        inputRef.current?.select();
      } else if (res.status === 'slow') {
        setFeedback({ kind: 'info', text: 'Từ từ thôi nào 😄' });
      } else if (res.status === 'paused') {
        setFeedback({ kind: 'info', text: 'Host đang tạm dừng, chờ chút nhé' });
      } else if (res.status === 'closed') {
        setFeedback({ kind: 'info', text: 'Hết giờ mất rồi!' });
      }
    } catch {
      setFeedback({ kind: 'info', text: 'Mạng chậm, gửi lại nhé' });
    } finally {
      setSending(false);
    }
  }

  if (now < state.startsAt) {
    return (
      <section className="player-body center">
        <p className="muted-light">Câu {state.qIndex + 1}/{state.qTotal}</p>
        <div className="countdown-number" key={Math.ceil((state.startsAt - now) / 1000)}>
          {Math.ceil((state.startsAt - now) / 1000)}
        </div>
        <p className="muted-light">Chuẩn bị nghe…</p>
      </section>
    );
  }

  const points = earned ?? (state.round.correct ? state.round.points : null);
  if (points !== null) {
    return (
      <section className="player-body center">
        <AnimatedEmoji char="🎉" className="pop" once />
        <h2>Chính xác!</h2>
        <p className="points-gain">+{points}</p>
        <p className="muted-light">Chờ mọi người đoán xong nhé…</p>
      </section>
    );
  }

  const total = state.endsAt - state.startsAt;
  const remaining = Math.max(0, state.endsAt - now);
  return (
    <section className="player-body">
      <div className="question-head">
        <span>
          Câu {state.qIndex + 1}/{state.qTotal}
        </span>
        <span className={remaining <= 5000 ? 'urgent-text' : ''}>{Math.ceil(remaining / 1000)}s</span>
      </div>
      <div className="time-bar">
        <div className="time-bar-fill" style={{ width: `${(remaining / total) * 100}%` }} />
      </div>
      <h2 className="text-center">
        <EmojiText text="Bài hát này tên gì? 🎧" />
      </h2>
      <form className="guess-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="input input-guess"
          placeholder="Gõ tên bài hát…"
          value={text}
          onChange={handleTextChange}
          maxLength={100}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          autoFocus
        />
        <button className="btn btn-primary btn-lg" disabled={!text.trim() || sending || remaining <= 0 || Boolean(state.pausedAt)}>
          <Send /> Gửi
        </button>
      </form>
      {feedback && (
        <p className={`feedback feedback-${feedback.kind}`}>
          <EmojiText text={feedback.text} />
        </p>
      )}
      <p className="hint">
        <EmojiText text="Không phân biệt hoa thường, dấu câu, có dấu hay không 😉" />
      </p>
    </section>
  );
}
