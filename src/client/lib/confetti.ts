import confetti from 'canvas-confetti';

export function burst() {
  void confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 } });
}

export function celebrate(durationMs = 3000) {
  const end = Date.now() + durationMs;
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
    void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
