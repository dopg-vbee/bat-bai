import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import type { PlayerState } from '../../../shared/types.ts';
import { AnimatedEmoji } from '../../components/Emoji.tsx';
import { Podium } from '../../components/Podium.tsx';
import { TeamBadge } from '../../components/Team.tsx';
import { celebrate } from '../../lib/confetti.ts';
import { Link } from '../../lib/router.tsx';

export function PlayerEnded({ state }: { state: PlayerState }) {
  const { me } = state;
  const teamRank = state.teams && me.team !== null ? state.teams.findIndex((t) => t.team === me.team) + 1 : 0;
  // "Together" mode: teammates all score alike, so the team's place is what counts.
  const byTeam = state.teamMode === 'together' && teamRank > 0;
  const rank = byTeam ? teamRank : me.rank;
  const onPodium = rank <= 3;

  useEffect(() => {
    if (onPodium) celebrate(2500);
  }, [onPodium]);

  return (
    <section className="player-body center">
      {onPodium && <AnimatedEmoji char="🏆" className="pop" once />}
      <h2>{onPodium ? (byTeam ? 'Đội bạn lên bục vinh danh!' : 'Bạn lên bục vinh danh!') : 'Kết thúc rồi!'}</h2>
      <div className="rank-line">
        <span>{byTeam ? 'Đội bạn hạng' : 'Bạn hạng'}</span>
        <strong className="rank-big">#{rank}</strong>
        <span>với {me.score.toLocaleString('vi-VN')} điểm</span>
      </div>
      {!byTeam && teamRank > 0 && me.team !== null && (
        <p className="team-rank-line">
          <TeamBadge team={me.team} /> hạng #{teamRank}
        </p>
      )}
      {state.podium && <Podium entries={state.podium} />}
      <Link to="/" className="btn btn-ghost">
        <ArrowLeft /> Chơi phòng khác
      </Link>
    </section>
  );
}
