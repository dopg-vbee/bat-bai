import { LogOut } from 'lucide-react';
import { BrandMark } from '../../components/Brand.tsx';
import { ThemeToggle } from '../../components/ThemeToggle.tsx';
import { Link } from '../../lib/router.tsx';

export function AdminHeader({ title, onLogout }: { title: string; onLogout: () => void }) {
  return (
    <header className="admin-bar">
      <Link to="/admin" className="host-brand admin-brand">
        <BrandMark />
      </Link>
      <span className="admin-bar-title">{title}</span>
      <ThemeToggle />
      <button className="btn btn-ghost btn-sm" onClick={onLogout}>
        <LogOut /> Đăng xuất
      </button>
    </header>
  );
}
