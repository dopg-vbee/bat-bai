import { ArrowLeft, Eye, Flag, Menu, Moon, Sun, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { Link } from '../../lib/router.tsx';
import { toggleTheme, useTheme } from '../../lib/theme.ts';

interface HostMenuProps {
  state: HostState;
  onEnd: () => void;
}

/** Room info and host actions behind one icon; opens on hover (or tap on touch screens). */
export function HostMenu({ state, onEnd }: HostMenuProps) {
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
