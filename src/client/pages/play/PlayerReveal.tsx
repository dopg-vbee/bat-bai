import type { PlayerState } from '../../../shared/types.ts';
import { CountUp } from '../../components/AnimatedLeaderboard.tsx';
import { AnimatedEmoji, Emoji, EmojiText } from '../../components/Emoji.tsx';
import { StreakTag } from '../../components/Fire.tsx';
import { Delta } from '../../components/Leaderboard.tsx';
import { DoubleTag, GiftTag } from '../../components/Luck.tsx';
import { TeamBadge } from '../../components/Team.tsx';

export function PlayerReveal({ state }: { state: PlayerState }) {
  const { round, me } = state;
  const teamRank = state.teams && me.team !== null ? state.teams.findIndex((t) => t.team === me.team) + 1 : 0;
  // "Together" mode: teammates all score alike, so only the team's place means anything.
  const byTeam = state.teamMode === 'together' && teamRank > 0;
  return (
    <section className="player-body center">
      <AnimatedEmoji char={round.correct ? '🥳' : '😅'} className="pop" once />
      <h2>{round.correct ? `+${round.points} điểm` : 'Tiếc quá!'}</h2>
      <StreakTag streak={round.streak} long className="streak-tag-lg" />
      {(round.gift > 0 || (state.double && round.correct)) && (
        <p className="luck-line">
          {state.double && round.correct && <DoubleTag />}
          {round.gift > 0 && <GiftTag gift={round.gift} />}
        </p>
      )}
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
      {byTeam ? (
        <div className="rank-line">
          <span>Đội bạn hạng</span>
          <strong className="rank-big">#{teamRank}</strong>
        </div>
      ) : (
        <div className="rank-line">
          <span>Hạng</span>
          <strong className="rank-big">#{me.rank}</strong>
          {me.delta !== 0 && <Delta value={me.delta} />}
        </div>
      )}
      {!byTeam && teamRank > 0 && me.team !== null && (
        <p className="team-rank-line">
          <TeamBadge team={me.team} /> hạng #{teamRank}
        </p>
      )}
      <p className="muted-light">
        <EmojiText text="Xem bảng xếp hạng trên màn hình lớn 📺" />
      </p>
    </section>
  );
}
