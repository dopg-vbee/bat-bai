const BARS = 9;

export function Equalizer({ playing }: { playing: boolean }) {
  return (
    <div className={`equalizer${playing ? ' playing' : ''}`} aria-hidden>
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} style={{ animationDelay: `${(i % 4) * 0.15 + i * 0.03}s` }} />
      ))}
    </div>
  );
}
