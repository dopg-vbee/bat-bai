import { AnimatedEmoji } from '../../components/Emoji.tsx';

/** The phones' side of the finale beat: the game is over, results next. */
export function PlayerFinale() {
  return (
    <section className="player-body center">
      <AnimatedEmoji char="🏁" className="pop" once />
      <h2>Trò chơi đã kết thúc!</h2>
      <p className="muted-light">Chuẩn bị tổng kết điểm…</p>
    </section>
  );
}
