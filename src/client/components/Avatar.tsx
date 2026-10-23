interface AvatarProps {
  avatar: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ avatar, color, size = 'md' }: AvatarProps) {
  return (
    <span className={`avatar avatar-${size}`} style={{ background: color }} aria-hidden>
      {avatar}
    </span>
  );
}
