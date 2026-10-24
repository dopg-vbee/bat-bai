import type { CSSProperties, MouseEvent } from 'react';
import { TEAMS, type TeamStanding } from '../../../shared/types.ts';
import { Emoji } from '../../components/Emoji.tsx';
import { socket } from '../../lib/socket.ts';

/** Lobby only: the player's team (filled automatically) and the others to switch to. */
export function TeamPicker({ teams, mine }: { teams: TeamStanding[]; mine: number | null }) {
  function handlePick(event: MouseEvent<HTMLButtonElement>) {
    socket.emit('player:team', Number(event.currentTarget.dataset.team));
  }

  return (
    <div className="team-picker">
      <p className="muted-light">Đội của bạn (đổi được tới khi bắt đầu)</p>
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
