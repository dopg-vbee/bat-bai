import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { GuessResult } from '../../shared/types.ts';
import { burst } from './confetti.ts';

export type Feedback = { kind: 'wrong' | 'close' | 'info'; text: string } | null;
export type Earned = Omit<Extract<GuessResult, { status: 'correct' }>, 'status'>;

const SHAKE = [0, -10, 10, -8, 8, 0].map((x) => ({ transform: `translateX(${x}px)` }));

/** The answer box's state: what is typed, sending it, and the feedback (or points) that comes back. */
export function useGuess(send: (text: string) => Promise<GuessResult>) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [earned, setEarned] = useState<Earned | null>(null);
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
      const res = await send(guess);
      if (res.status === 'correct') {
        setEarned(res);
        burst();
      } else if (res.status === 'wrong' || res.status === 'close') {
        setFeedback(
          res.status === 'close'
            ? { kind: 'close', text: 'Gần đúng rồi, thử lại!' }
            : { kind: 'wrong', text: 'Chưa đúng rồi, thử lại!' },
        );
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

  return { text, sending, feedback, earned, inputRef, handleTextChange, handleSubmit };
}
