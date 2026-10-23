import { Play, Smartphone, X } from 'lucide-react';
import type { HostState, PlayerSummary } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { openPlayerWindow } from '../../lib/rooms.ts';
import { socket } from '../../lib/socket.ts';
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

export function HostLobby({ state }: { state: HostState }) {
  function handleStart() {
    socket.emit('host:next');
  }

  function handleOpenPlayer() {
    openPlayerWindow(state.code);
  }

  return (
    <section className="host-lobby">
      <JoinCard code={state.code} />
      <div className="lobby-side">
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
        <button className="btn btn-primary btn-xl" onClick={handleStart} disabled={!state.players.length}>
          <Play /> Bắt đầu ({state.qTotal} câu)
        </button>
        <ul className="player-grid">
          {state.players.map((player) => (
            <PlayerChip key={player.id} player={player} />
          ))}
        </ul>
      </div>
    </section>
  );
}
