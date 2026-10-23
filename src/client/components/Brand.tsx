import { Mic } from 'lucide-react';

/** Big title on the home / join / login screens. */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`logo${small ? ' logo-sm' : ''}`}>
      Bắt Bài <Mic className="logo-icon" strokeWidth={2.5} />
    </h1>
  );
}

/** Compact wordmark for the host and admin bars. */
export function BrandMark() {
  return (
    <>
      <Mic className="brand-icon" strokeWidth={2.5} /> Bắt Bài
    </>
  );
}
