interface TimerRingProps {
  remainingMs: number;
  totalMs: number;
  size?: number;
}

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TimerRing({ remainingMs, totalMs, size = 160 }: TimerRingProps) {
  const ratio = totalMs > 0 ? Math.min(Math.max(remainingMs / totalMs, 0), 1) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = seconds <= 5;
  return (
    <div className={`timer-ring${urgent ? ' urgent' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle className="timer-track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="timer-progress"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      <span className="timer-value">{Math.max(seconds, 0)}</span>
    </div>
  );
}
