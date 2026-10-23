import type { LucideIcon } from 'lucide-react';

interface StatusBadgeProps {
  icon: LucideIcon;
  tone?: 'danger' | 'neutral';
  pop?: boolean;
}

/** Large round icon used for status screens (kicked, errors, empty states). */
export function StatusBadge({ icon: Icon, tone = 'neutral', pop = false }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${tone}${pop ? ' pop' : ''}`}>
      <Icon strokeWidth={2.25} />
    </span>
  );
}
