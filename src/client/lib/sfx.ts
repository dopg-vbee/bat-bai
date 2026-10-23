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

const FANFARE_NOTES = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6

function note(ac: AudioContext, hz: number, start: number, length: number, volume: number, type: OscillatorType) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** Short victory fanfare: four quick rising notes, then a ringing major chord. */
export function playFanfare() {
  const ac = audio();
  const now = ac.currentTime;
  FANFARE_NOTES.forEach((hz, i) => note(ac, hz, now + i * 0.11, 0.18, VOLUME, 'square'));
  const chordAt = now + FANFARE_NOTES.length * 0.11 + 0.04;
  FANFARE_NOTES.forEach((hz) => note(ac, hz, chordAt, 1.1, VOLUME * 0.55, 'triangle'));
}
