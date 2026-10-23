import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { HostState, PlayerSummary } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { openPlayerWindow } from '../../lib/rooms.ts';
import { socket } from '../../lib/socket.ts';

/** On localhost, phones cannot reach "localhost": point the QR at the LAN address instead. */
function useJoinUrl(code: string) {
  const [base, setBase] = useState(location.origin);
  useEffect(() => {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
    fetch('/api/info')
      .then((res) => res.json())
      .then((info: { lanAddresses: string[] }) => {
        const ip = info.lanAddresses[0];
        if (ip) setBase(`${location.protocol}//${ip}${location.port ? `:${location.port}` : ''}`);
      })
      .catch(() => undefined);
  }, []);
  return `${base}/play/${code}`;
}

function PlayerChip({ player }: { player: PlayerSummary }) {
  function handleKick() {
    if (confirm(`Mời "${player.name}" ra khỏi phòng?`)) socket.emit('host:kick', player.id);
  }
  return (
    <li className={`player-chip${player.connected ? '' : ' offline'}`}>
      <Avatar avatar={player.avatar} color={player.color} size="sm" />
      <span className="player-chip-name">{player.name}</span>
      <button className="player-chip-kick" onClick={handleKick} title="Mời ra">
        ×
      </button>
    </li>
  );
}

export function HostLobby({ state }: { state: HostState }) {
  const joinUrl = useJoinUrl(state.code);
  const [qr, setQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { width: 480, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [joinUrl]);

  function handleStart() {
    socket.emit('host:next');
  }

  function handleOpenPlayer() {
    openPlayerWindow(state.code);
  }

  return (
    <section className="host-lobby">
      <div className="card join-card">
        <p className="join-step">📱 Quét mã để vào chơi</p>
        {qr ? <img className="qr" src={qr} alt={`QR vào phòng ${state.code}`} /> : <div className="qr" />}
        <p className="join-or">hoặc vào <strong>{joinUrl.replace(/\/play\/\d+$/, '')}</strong> và nhập mã</p>
        <div className="room-code">{state.code}</div>
      </div>
      <div className="lobby-side">
        <h2 className="lobby-title">
          {state.players.length ? `${state.players.length} người đã vào` : 'Đang chờ người chơi…'}
        </h2>
        {state.preview && (
          <div className="preview-note">
            <p>
              Đây là phòng <strong>chơi thử</strong>: 8 bot sẽ tự đoán như người thật. Mở thêm màn hình người chơi
              để tự trả lời trên "điện thoại".
            </p>
            <button className="btn btn-ghost" onClick={handleOpenPlayer}>
              📱 Mở màn hình người chơi
            </button>
          </div>
        )}
        <ul className="player-grid">
          {state.players.map((player) => (
            <PlayerChip key={player.id} player={player} />
          ))}
        </ul>
        <button className="btn btn-primary btn-xl" onClick={handleStart} disabled={!state.players.length}>
          Bắt đầu ▶ ({state.qTotal} câu)
        </button>
      </div>
    </section>
  );
}
