/** Music notes drifting up behind every screen: position, size, speed and delay fixed so nothing re-renders. */
const NOTES = [
  { glyph: '♪', left: 6, size: 34, duration: 26, delay: -4 },
  { glyph: '♫', left: 15, size: 52, duration: 34, delay: -19 },
  { glyph: '♩', left: 27, size: 28, duration: 24, delay: -11 },
  { glyph: '♬', left: 38, size: 44, duration: 31, delay: -2 },
  { glyph: '♪', left: 49, size: 60, duration: 38, delay: -26 },
  { glyph: '♫', left: 58, size: 30, duration: 25, delay: -14 },
  { glyph: '♩', left: 67, size: 48, duration: 33, delay: -8 },
  { glyph: '♬', left: 76, size: 36, duration: 28, delay: -22 },
  { glyph: '♪', left: 85, size: 56, duration: 36, delay: -16 },
  { glyph: '♫', left: 93, size: 32, duration: 27, delay: -6 },
] as const;

/**
 * A lively backdrop for the whole app: soft colour blobs drifting slowly and notes floating up.
 * It lies behind the pages (z-index -1), takes no clicks, and only moves transform and opacity.
 */
export function AnimatedBackground() {
  return (
    <div className="bg-fx" aria-hidden>
      <span className="bg-blob bg-blob-1" />
      <span className="bg-blob bg-blob-2" />
      <span className="bg-blob bg-blob-3" />
      {NOTES.map((note, i) => (
        <span
          key={i}
          className="bg-note"
          style={{
            left: `${note.left}%`,
            fontSize: note.size,
            animationDuration: `${note.duration}s`,
            animationDelay: `${note.delay}s`,
          }}
        >
          {note.glyph}
        </span>
      ))}
    </div>
  );
}
