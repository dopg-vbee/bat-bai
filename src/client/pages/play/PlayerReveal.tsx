import type { PlayerState } from '../../../shared/types.ts';

export function PlayerReveal({ state }: { state: PlayerState }) {
  const { round, me } = state;
  return (
    <section className="player-body center">
      <div className="emoji-xl pop">{round.correct ? '🎉' : '😅'}</div>
      <h2>{round.correct ? `+${round.points} điểm` : 'Tiếc quá!'}</h2>
      <div className="card answer-card">
        <span className="label">Đáp án</span>
        <strong className="answer-title">{state.answer}</strong>
      </div>
      <div className="rank-line">
        <span>Hạng</span>
        <strong className="rank-big">#{me.rank}</strong>
        {me.delta > 0 && <span className="delta up">▲{me.delta}</span>}
        {me.delta < 0 && <span className="delta down">▼{-me.delta}</span>}
      </div>
      <p className="muted-light">Xem bảng xếp hạng trên màn hình lớn 📺</p>
    </section>
  );
}
