import { useEffect } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { Leaderboard } from '../../components/Leaderboard.tsx';
import { Podium } from '../../components/Podium.tsx';
import { celebrate } from '../../lib/confetti.ts';
import { Link } from '../../lib/router.tsx';

export function HostEnded({ state }: { state: HostState }) {
  const podium = state.leaderboard.slice(0, 3);
  const rest = state.leaderboard.slice(3);

  useEffect(() => {
    celebrate(4000);
  }, []);

  return (
    <section className="host-ended">
      <h1 className="ended-title">🏆 Chúc mừng nhà vô địch!</h1>
      <Podium entries={podium} large />
      {rest.length > 0 && <Leaderboard rows={rest} showRoundPoints={false} />}
      <Link to="/admin" className="btn btn-ghost">
        Về trang quản lý
      </Link>
    </section>
  );
}
