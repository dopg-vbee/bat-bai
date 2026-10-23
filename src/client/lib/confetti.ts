import confetti from 'canvas-confetti';

export function burst(origin: { x?: number; y?: number } = { y: 0.7 }) {
  void confetti({ particleCount: 90, spread: 75, origin });
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

/** Bursts of confetti at random spots across the screen, like fireworks. */
export function fireworks(durationMs = 1800) {
  const end = Date.now() + durationMs;
  const timer = setInterval(() => {
    if (Date.now() > end) return clearInterval(timer);
    void confetti({
      particleCount: 55,
      spread: 360,
      startVelocity: 32,
      ticks: 70,
      gravity: 0.9,
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.45 },
      colors: ['#facc15', '#f472b6', '#c084fc', '#86efac', '#ffffff'],
    });
  }, 260);
}
