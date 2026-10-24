import type { CSSProperties, MouseEvent } from 'react';
import { TEAMS, type TeamStanding } from '../../../shared/types.ts';
import { Emoji } from '../../components/Emoji.tsx';
import { socket } from '../../lib/socket.ts';

/** Lobby only: pick a team (the game waits until everyone has one), switch freely until it starts. */
export function TeamPicker({ teams, mine }: { teams: TeamStanding[]; mine: number | null }) {
  function handlePick(event: MouseEvent<HTMLButtonElement>) {
    socket.emit('player:team', Number(event.currentTarget.dataset.team));
  }

  return (
    <div className="team-picker">
      {mine === null ? (
        <p className="team-picker-ask">Chọn đội của bạn để bắt đầu</p>
      ) : (
        <p className="muted-light">Đổi đội được tới khi bắt đầu</p>
      )}
      <div className="team-picker-options">
        {[...teams]
          .sort((a, b) => a.team - b.team)
          .map(({ team, members }) => (
            <button
              key={team}
              type="button"
              data-team={team}
              className={`team-option${team === mine ? ' mine' : ''}`}
              style={{ '--team': TEAMS[team].color } as CSSProperties}
              onClick={handlePick}
            >
              <Emoji char={TEAMS[team].emoji} /> Đội {TEAMS[team].name}
              <small>{members} người</small>
            </button>
          ))}
      </div>
    </div>
  );
}
