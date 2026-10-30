import { Eye, EyeOff, Play, Shuffle, Users, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TEAMS, type HostState, type PlayerSummary } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { TeamBadge } from '../../components/Team.tsx';
import { socket } from '../../lib/socket.ts';
import { readStorage, storageKeys, writeStorage } from '../../lib/storage.ts';
import { useSize } from '../../lib/useSize.ts';
import { JoinCard } from './JoinCard.tsx';

function PlayerChip({ player }: { player: PlayerSummary }) {
  function handleKick() {
    if (confirm(`Mời "${player.name}" ra khỏi phòng?`)) socket.emit('host:kick', player.id);
  }
  return (
    <li className={`player-chip${player.connected ? '' : ' offline'}`}>
      <Avatar avatar={player.avatar} color={player.color} size="lg" />
      <span className="player-chip-name">{player.name}</span>
      <button className="player-chip-kick" onClick={handleKick} title="Mời ra" aria-label={`Mời ${player.name} ra khỏi phòng`}>
        <X />
      </button>
    </li>
  );
}

// Avatars grow while few players are in and shrink as more join, to fill the list without scrolling.
// Bounded: never huge for a handful, and below the minimum the list scrolls instead.
const MIN_AVATAR = 52;
const MAX_AVATAR = 120;
/** Matches the gaps of .player-grid. */
const GAP_X = 12;
const GAP_Y = 16;

/** A player tile for an avatar `size` px wide: the name (up to two lines) sits below it. */
function tile(size: number) {
  const font = Math.min(22, Math.max(13, Math.round(size * 0.2)));
  return { width: size + 36, height: size + 6 + font * 2.4, font };
}

/** The largest avatar at which `count` players fit a `width` × `height` list. */
function fitAvatar(count: number, width: number, height: number): number {
  for (let size = MAX_AVATAR; size > MIN_AVATAR; size -= 4) {
    const { width: w, height: h } = tile(size);
    const columns = Math.max(1, Math.floor((width + GAP_X) / (w + GAP_X)));
    if (Math.ceil(count / columns) * (h + GAP_Y) - GAP_Y <= height) return size;
  }
  return MIN_AVATAR;
}

const GHOST_SLOTS = 6;
const JOIN_STEPS = ['Quét mã QR hoặc vào địa chỉ ở bên trái', 'Nhập mã phòng 4 số', 'Gõ tên rồi chờ bắt đầu'];

/** Before anyone has joined: empty seats that light up in turn, and the three steps to get in. */
function EmptyLobby() {
  return (
    <div className="lobby-empty">
      <div className="lobby-ghosts" aria-hidden>
        {Array.from({ length: GHOST_SLOTS }, (_, i) => (
          <span key={i} className="lobby-ghost" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <ol className="lobby-steps">
        {JOIN_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

interface PlayerListProps {
  players: PlayerSummary[];
  /** Size the tiles for this many players (team boxes share the size of the fullest one). */
  fitCount?: number;
  /** Never bigger than this, e.g. the team boxes' size for the players without a team. */
  maxAvatar?: number;
  onAvatar?: (size: number) => void;
}

function PlayerList({ players, fitCount = players.length, maxAvatar = MAX_AVATAR, onAvatar }: PlayerListProps) {
  const ref = useRef<HTMLUListElement>(null);
  const box = useSize(ref);
  const size = box.width ? Math.min(maxAvatar, fitAvatar(fitCount, box.width, box.height)) : MIN_AVATAR;
  useEffect(() => onAvatar?.(size), [size, onAvatar]);
  const { width, font } = tile(size);
  const style = { '--avatar': `${size}px`, '--chip': `${width}px`, '--chip-font': `${font}px` } as CSSProperties;
  return (
    <ul ref={ref} className="player-grid" style={style}>
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
  const members = TEAMS.slice(0, teamCount).map((_, i) => players.filter((p) => p.team === i));
  const fullest = Math.max(...members.map((m) => m.length));
  const [teamAvatar, setTeamAvatar] = useState(MAX_AVATAR);
  return (
    <div className="team-area">
      <div className="team-boxes" style={{ '--cols': boxColumns(teamCount) } as CSSProperties}>
        {TEAMS.slice(0, teamCount).map((team, i) => (
          <section key={team.name} className="team-box" style={{ '--team': team.color } as CSSProperties}>
            <header className="team-box-head">
              {teamCount > 5 ? (
                // Narrow boxes: the colour name and an icon count keep it on one line.
                <>
                  <TeamBadge team={i} short /> <Users /> {members[i].length}
                </>
              ) : (
                <>
                  <TeamBadge team={i} /> {members[i].length} người
                </>
              )}
            </header>
            {/* Every team box is the same size, so the first one speaks for all. */}
            <PlayerList players={members[i]} fitCount={fullest} onAvatar={i === 0 ? setTeamAvatar : undefined} />
          </section>
        ))}
      </div>
      {teamless.length > 0 && (
        <section className="team-box teamless">
          <header className="team-box-head">Chưa có đội · {teamless.length} người</header>
          <PlayerList players={teamless} maxAvatar={teamAvatar} />
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
        {/* Above the list, so the buttons stay on screen however many players join. */}
        <div className="lobby-head">
          <h2 className="lobby-title">
            {state.players.length ? `${state.players.length} người đã vào` : 'Đang chờ người chơi…'}
          </h2>
          <div className="lobby-actions">
            {teamPlay && (
              <button className="btn btn-ghost btn-lg" onClick={handleShuffle} disabled={!state.players.length}>
                <Shuffle /> Xếp đội ngẫu nhiên
              </button>
            )}
            <button className="btn btn-primary btn-xl" onClick={handleStart} disabled={!canStart}>
              <Play /> Bắt đầu ({state.qTotal} câu)
            </button>
          </div>
        </div>
        {teamPlay && teamless > 0 && (
          <p className="lobby-hint">
            Còn {teamless} người chưa có đội: chờ họ chọn trên điện thoại, hoặc bấm "Xếp đội ngẫu nhiên".
          </p>
        )}
        {teamPlay ? (
          <TeamBoxes players={state.players} teamCount={state.teams.length} />
        ) : state.players.length > 0 ? (
          <PlayerList players={state.players} />
        ) : (
          <EmptyLobby />
        )}
      </div>
    </section>
  );
}
