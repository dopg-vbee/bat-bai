import { Send } from 'lucide-react';
import type { PlayerState } from '../../../shared/types.ts';
import { AnimatedEmoji, EmojiText } from '../../components/Emoji.tsx';
import { StreakTag } from '../../components/Fire.tsx';
import { BorrowQuip, GiftTag, LuckyBanner, MultiplierTag } from '../../components/Luck.tsx';
import { socket, useServerNow } from '../../lib/socket.ts';
import { useGuess } from '../../lib/useGuess.ts';

const sendGuess = (text: string) => socket.timeout(5000).emitWithAck('player:guess', text);

export function PlayerQuestion({ state }: { state: PlayerState }) {
  // While paused the clock stands still at the moment the host paused.
  const live = useServerNow(!state.pausedAt, 100);
  const now = state.pausedAt || live;
  const { text, sending, feedback, earned, inputRef, handleTextChange, handleSubmit } = useGuess(sendGuess);

  if (now < state.startsAt) {
    return (
      <section className="player-body center">
        <p className="muted-light">Câu {state.qIndex + 1}/{state.qTotal}</p>
        <div className="countdown-number" key={Math.ceil((state.startsAt - now) / 1000)}>
          {Math.ceil((state.startsAt - now) / 1000)}
        </div>
        {state.multiplier > 1 ? (
          <LuckyBanner multiplier={state.multiplier} />
        ) : (
          <p className="muted-light">Chuẩn bị nghe…</p>
        )}
      </section>
    );
  }

  const result = earned ?? (state.round.correct ? state.round : null);
  if (result) {
    // "Together" team mode: a teammate's answer counted for this player too.
    const byTeam = !earned && state.round.byTeam;
    const title = byTeam
      ? 'Đội bạn đã đoán đúng!'
      : result.stolenFrom
        ? `Chính xác! Mượn được điểm của ${result.stolenFrom}!`
        : result.gift
          ? 'Chính xác! Trúng hộp quà!'
          : 'Chính xác!';
    return (
      <section className="player-body center">
        <AnimatedEmoji char={result.stolenFrom ? '💸' : result.gift ? '🎁' : '🎉'} className="pop" once />
        <h2>{title}</h2>
        <p className="points-gain">+{result.points}</p>
        {result.gift > 0 && (
          <GiftTag gift={result.gift} stolenFrom={result.stolenFrom} long className="gift-tag-lg" />
        )}
        {result.stolenFrom && <BorrowQuip />}
        {state.multiplier > 1 && <MultiplierTag multiplier={state.multiplier} />}
        <StreakTag streak={result.streak} long className="streak-tag-lg" />
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
          Câu {state.qIndex + 1}/{state.qTotal}{' '}
          {state.multiplier > 1 && <MultiplierTag multiplier={state.multiplier} />}
        </span>
        <span className={remaining <= 5000 ? 'urgent-text' : ''}>{Math.ceil(remaining / 1000)}s</span>
      </div>
      <div
        className="time-bar"
        role="progressbar"
        aria-label="Thời gian còn lại"
        aria-valuemin={0}
        aria-valuemax={Math.round(total / 1000)}
        aria-valuenow={Math.ceil(remaining / 1000)}
      >
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
        <p className={`feedback feedback-${feedback.kind}`} role="status">
          <EmojiText text={feedback.text} />
        </p>
      )}
      <p className="hint">
        <EmojiText text="Không phân biệt hoa thường, dấu câu, có dấu hay không 😉" />
      </p>
    </section>
  );
}
