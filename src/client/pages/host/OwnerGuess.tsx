import { CircleCheck, Send } from 'lucide-react';
import type { HostState } from '../../../shared/types.ts';
import { EmojiText } from '../../components/Emoji.tsx';
import { socket } from '../../lib/socket.ts';
import { useGuess } from '../../lib/useGuess.ts';

const sendGuess = (text: string) => socket.timeout(5000).emitWithAck('host:guess', text);

/** The room owner's answer box on their host screen (an admin's host screen has none). */
export function OwnerGuess({ state, remainingMs }: { state: HostState; remainingMs: number }) {
  const { text, sending, feedback, earned, inputRef, handleTextChange, handleSubmit } = useGuess(sendGuess);
  const done = earned !== null || state.players.some((p) => p.id === state.ownerId && p.correct);

  if (done) {
    return (
      <p className="owner-guess-done">
        <CircleCheck /> Bạn đã đoán đúng{earned ? ` · +${earned.points}` : ''}
      </p>
    );
  }

  return (
    <div className="owner-guess">
      <form className="owner-guess-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="input input-guess"
          placeholder="Bạn đoán tên bài hát…"
          aria-label="Đáp án của bạn"
          value={text}
          onChange={handleTextChange}
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        <button className="btn btn-primary" disabled={!text.trim() || sending || remainingMs <= 0 || Boolean(state.pausedAt)}>
          <Send /> Gửi
        </button>
      </form>
      {feedback && (
        <p className={`feedback feedback-${feedback.kind}`}>
          <EmojiText text={feedback.text} />
        </p>
      )}
    </div>
  );
}
