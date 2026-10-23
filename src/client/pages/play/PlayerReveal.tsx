import type { PlayerState } from '../../../shared/types.ts';
import { CountUp } from '../../components/AnimatedLeaderboard.tsx';
import { AnimatedEmoji, Emoji, EmojiText } from '../../components/Emoji.tsx';
import { Delta } from '../../components/Leaderboard.tsx';

export function PlayerReveal({ state }: { state: PlayerState }) {
  const { round, me } = state;
  return (
    <section className="player-body center">
      <AnimatedEmoji char={round.correct ? '🥳' : '😅'} className="pop" once />
      <h2>{round.correct ? `+${round.points} điểm` : 'Tiếc quá!'}</h2>
      <div className="card answer-card">
        <span className="label">Đáp án</span>
        <strong className="answer-title">{state.answer}</strong>
      </div>
      {state.allCorrect && (
        <p className="pill all-correct-pill">
          <Emoji char="💯" /> Cả phòng đều đúng!
        </p>
      )}
      <p className="total-line">
        Tổng điểm{' '}
        <strong>
          <CountUp from={me.score - round.points} to={me.score} run />
        </strong>
      </p>
      <div className="rank-line">
        <span>Hạng</span>
        <strong className="rank-big">#{me.rank}</strong>
        {me.delta !== 0 && <Delta value={me.delta} />}
      </div>
      <p className="muted-light">
        <EmojiText text="Xem bảng xếp hạng trên màn hình lớn 📺" />
      </p>
    </section>
  );
}
