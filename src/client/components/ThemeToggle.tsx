import { Moon, Sun } from 'lucide-react';
import { toggleTheme, useTheme } from '../lib/theme.ts';

/** Sun/moon button. `floating` pins it to the top-right corner on screens without a header bar. */
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const theme = useTheme();
  const label = theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm theme-toggle${floating ? ' floating' : ''}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  );
}
