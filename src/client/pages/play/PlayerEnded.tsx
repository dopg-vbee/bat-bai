import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import type { PlayerState } from '../../../shared/types.ts';
import { AnimatedEmoji } from '../../components/Emoji.tsx';
import { Podium } from '../../components/Podium.tsx';
import { celebrate } from '../../lib/confetti.ts';
import { Link } from '../../lib/router.tsx';

export function PlayerEnded({ state }: { state: PlayerState }) {
  const { me } = state;
  const onPodium = me.rank <= 3;

  useEffect(() => {
    if (onPodium) celebrate(2500);
  }, [onPodium]);

  return (
    <section className="player-body center">
      {onPodium && <AnimatedEmoji char="🏆" className="pop" once />}
      <h2>{onPodium ? 'Bạn lên bục vinh danh!' : 'Kết thúc rồi!'}</h2>
      <div className="rank-line">
        <span>Bạn hạng</span>
        <strong className="rank-big">#{me.rank}</strong>
        <span>với {me.score.toLocaleString('vi-VN')} điểm</span>
      </div>
      {state.podium && <Podium entries={state.podium} />}
      <Link to="/" className="btn btn-ghost">
        <ArrowLeft /> Chơi phòng khác
      </Link>
    </section>
  );
}
