// Sound effects synthesised with Web Audio: no files to download, no licensing.

let context: AudioContext | null = null;

function audio(): AudioContext {
  context ??= new AudioContext();
  // Starts suspended until the page has had a click; the host has clicked "Bắt đầu" by now.
  if (context.state === 'suspended') void context.resume();
  return context;
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
const BASE_HZ = 784; // G5
const VOLUME = 0.22;

/**
 * Bright two-note "ting" for a correct answer. `step` walks up a major scale, so a burst
 * of correct answers climbs like an arpeggio instead of repeating the same beep.
 */
export function playCorrectChime(step = 0) {
  const ac = audio();
  const root = BASE_HZ * 2 ** (MAJOR_SCALE[step % MAJOR_SCALE.length] / 12);
  [1, 1.5].forEach((ratio, i) => {
    const start = ac.currentTime + i * 0.07;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = root * ratio;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(VOLUME, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  });
}
