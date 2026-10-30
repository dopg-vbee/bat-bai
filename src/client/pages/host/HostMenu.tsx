import { ArrowLeft, Eye, Flag, Menu, Moon, Music, QrCode, Smartphone, SquareUser, Sun, Users, VolumeX } from 'lucide-react';
import { useRef, useState } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { openPlayerWindow } from '../../lib/rooms.ts';
import { Link } from '../../lib/router.tsx';
import { toggleTheme, useTheme } from '../../lib/theme.ts';

interface HostMenuProps {
  state: HostState;
  musicOn: boolean;
  onToggleMusic: () => void;
  onEnd: () => void;
  onShowQr: () => void;
  onShowRemote: () => void;
}

/** Room info and host actions behind one icon; opens on hover (or tap on touch screens). */
export function HostMenu({ state, musicOn, onToggleMusic, onEnd, onShowQr, onShowRemote }: HostMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const online = state.players.filter((p) => p.connected).length;

  function handleToggle() {
    setOpen((value) => !value);
  }

  // Also drop focus left on a clicked item, otherwise :focus-within keeps the panel open.
  function handleLeave() {
    setOpen(false);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && menuRef.current?.contains(focused)) focused.blur();
  }

  function handleShowQr() {
    handleLeave();
    onShowQr();
  }

  // "Chơi thử": a phone-sized window to answer alongside the bots.
  function handleOpenPlayer() {
    handleLeave();
    openPlayerWindow(state.code);
  }

  function handleShowRemote() {
    handleLeave();
    onShowRemote();
  }

  return (
    <div ref={menuRef} className={`host-menu${open ? ' open' : ''}`} onMouseLeave={handleLeave}>
      <button className="btn btn-ghost icon-btn" onClick={handleToggle} aria-label="Menu" aria-expanded={open}>
        <Menu />
      </button>
      <div className="host-menu-panel" role="menu">
        <div className="host-menu-info">
          <span className="host-menu-code">Phòng {state.code}</span>
          <span>
            <Users /> {online} người chơi
          </span>
          {state.preview && (
            <span className="pill pill-preview">
              <Eye /> Chơi thử
            </span>
          )}
        </div>
        {state.preview && (
          <Link to="/admin" className="host-menu-item">
            <ArrowLeft /> Về trang quản lý
          </Link>
        )}
        {state.ownerId && (
          <Link to="/" className="host-menu-item">
            <ArrowLeft /> Về trang chủ
          </Link>
        )}
        {state.preview && state.phase !== 'ended' && (
          <button className="host-menu-item" role="menuitem" onClick={handleOpenPlayer}>
            <SquareUser /> Mở màn hình người chơi
          </button>
        )}
        {/* The lobby already shows the QR code. */}
        {state.phase !== 'lobby' && state.phase !== 'ended' && (
          <button className="host-menu-item" role="menuitem" onClick={handleShowQr}>
            <QrCode /> Mã QR vào phòng
          </button>
        )}
        {state.phase !== 'ended' && (
          <button className="host-menu-item" role="menuitem" onClick={handleShowRemote}>
            <Smartphone /> Điều khiển bằng điện thoại
          </button>
        )}
        <button className="host-menu-item" role="menuitem" onClick={onToggleMusic}>
          {musicOn ? <VolumeX /> : <Music />} {musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
        </button>
        <button className="host-menu-item" role="menuitem" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />} {theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
        </button>
        {state.phase !== 'ended' && (
          <button className="host-menu-item danger" role="menuitem" onClick={onEnd}>
            <Flag /> Kết thúc trò chơi
          </button>
        )}
      </div>
    </div>
  );
}
