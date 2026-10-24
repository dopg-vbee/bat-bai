import { Eye, EyeOff, Play, Shuffle, Smartphone, Users, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { TEAMS, type HostState, type PlayerSummary } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { TeamBadge } from '../../components/Team.tsx';
import { openPlayerWindow } from '../../lib/rooms.ts';
import { socket } from '../../lib/socket.ts';
import { readStorage, storageKeys, writeStorage } from '../../lib/storage.ts';
import { JoinCard } from './JoinCard.tsx';

function PlayerChip({ player }: { player: PlayerSummary }) {
  function handleKick() {
    if (confirm(`Mời "${player.name}" ra khỏi phòng?`)) socket.emit('host:kick', player.id);
  }
  return (
    <li className={`player-chip${player.connected ? '' : ' offline'}`}>
      <Avatar avatar={player.avatar} color={player.color} size="sm" />
      <span className="player-chip-name">{player.name}</span>
      <button className="player-chip-kick" onClick={handleKick} title="Mời ra">
        <X />
      </button>
    </li>
  );
}

function PlayerList({ players }: { players: PlayerSummary[] }) {
  return (
    <ul className="player-grid">
      {players.map((player) => (
        <PlayerChip key={player.id} player={player} />
      ))}
    </ul>
  );
}

/** Up to 5 team boxes a row; more teams split over two rows. */
const boxColumns = (teams: number) => (teams <= 5 ? teams : Math.ceil(teams / 2));

/** One box per team with its players, and those yet to pick a team below. */
function TeamBoxes({ players, teamCount }: { players: PlayerSummary[]; teamCount: number }) {
  const teamless = players.filter((p) => p.team === null);
  return (
    <div className="team-area">
      <div className="team-boxes" style={{ '--cols': boxColumns(teamCount) } as CSSProperties}>
        {TEAMS.slice(0, teamCount).map((team, i) => {
          const members = players.filter((p) => p.team === i);
          return (
            <section key={team.name} className="team-box" style={{ '--team': team.color } as CSSProperties}>
              <header className="team-box-head">
                {teamCount > 5 ? (
                  // Narrow boxes: the colour name and an icon count keep it on one line.
                  <>
                    <TeamBadge team={i} short /> <Users /> {members.length}
                  </>
                ) : (
                  <>
                    <TeamBadge team={i} /> {members.length} người
                  </>
                )}
              </header>
              <PlayerList players={members} />
            </section>
          );
        })}
      </div>
      {teamless.length > 0 && (
        <section className="team-box teamless">
          <header className="team-box-head">Chưa có đội · {teamless.length} người</header>
          <PlayerList players={teamless} />
        </section>
      )}
    </div>
  );
}

export function HostLobby({ state }: { state: HostState }) {
  const teamPlay = state.teamMode !== 'off';
  const teamless = state.players.filter((p) => p.team === null).length;
  // The server refuses too: a team game only starts once everyone has a team.
  const canStart = state.players.length > 0 && (!teamPlay || teamless === 0);
  // Folding the QR away gives the players (and team boxes) the whole width; remembered on this screen.
  const [qrShown, setQrShown] = useState(() => readStorage(storageKeys.lobbyQr) !== '0');

  function handleStart() {
    socket.emit('host:next');
  }

  function handleShuffle() {
    const anyChosen = state.players.some((p) => p.team !== null);
    if (anyChosen && !confirm('Xếp lại ngẫu nhiên tất cả người chơi vào các đội cho đều?')) return;
    socket.emit('host:shuffleTeams');
  }

  function handleToggleQr() {
    writeStorage(storageKeys.lobbyQr, qrShown ? '0' : null);
    setQrShown(!qrShown);
  }

  function handleOpenPlayer() {
    openPlayerWindow(state.code);
  }

  return (
    <section className={`host-lobby${qrShown ? '' : ' qr-hidden'}`}>
      {qrShown && (
        <div className="lobby-qr">
          <JoinCard code={state.code} />
          <button
            className="btn btn-ghost icon-btn lobby-qr-toggle"
            onClick={handleToggleQr}
            aria-label="Ẩn mã QR"
            title="Ẩn mã QR"
          >
            <EyeOff />
          </button>
        </div>
      )}
      <div className="lobby-side">
        {!qrShown && (
          <div className="lobby-code-bar">
            <span>
              Mã phòng <strong className="lobby-code">{state.code}</strong>
            </span>
            <button className="btn btn-ghost" onClick={handleToggleQr}>
              <Eye /> Hiện mã QR
            </button>
          </div>
        )}
        <h2 className="lobby-title">
          {state.players.length ? `${state.players.length} người đã vào` : 'Đang chờ người chơi…'}
        </h2>
        {state.preview && (
          <div className="preview-note">
            <p>
              Đây là phòng <strong>chơi thử</strong>: {state.players.filter((p) => p.bot).length} bot sẽ tự đoán như người thật; riêng <strong>Bot Luôn Đúng</strong> câu nào cũng đúng để xem chuỗi lửa. Mở thêm màn hình người chơi
              để tự trả lời trên "điện thoại".
            </p>
            <button className="btn btn-ghost" onClick={handleOpenPlayer}>
              <Smartphone /> Mở màn hình người chơi
            </button>
          </div>
        )}
        {/* Above the list, so it stays on screen however many players join. */}
        <div className="lobby-actions">
          <button className="btn btn-primary btn-xl" onClick={handleStart} disabled={!canStart}>
            <Play /> Bắt đầu ({state.qTotal} câu)
          </button>
          {teamPlay && (
            <button className="btn btn-ghost btn-lg" onClick={handleShuffle} disabled={!state.players.length}>
              <Shuffle /> Xếp đội ngẫu nhiên
            </button>
          )}
        </div>
        {teamPlay && teamless > 0 && (
          <p className="lobby-hint">
            Còn {teamless} người chưa có đội: chờ họ chọn trên điện thoại, hoặc bấm "Xếp đội ngẫu nhiên".
          </p>
        )}
        {teamPlay ? (
          <TeamBoxes players={state.players} teamCount={state.teams.length} />
        ) : (
          <PlayerList players={state.players} />
        )}
      </div>
    </section>
  );
}
