import { X } from 'lucide-react';
import { useEffect, type MouseEvent, type ReactNode } from 'react';

/** A centred pop-up over a dimmed page; closes on Esc, a click outside, or its X button. */
export function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="overlay" role="dialog" onClick={handleBackdrop}>
      <div className="overlay-body">
        <button className="btn btn-ghost icon-btn overlay-close" onClick={onClose} aria-label="Đóng" title="Đóng">
          <X />
        </button>
        {children}
      </div>
    </div>
  );
}
