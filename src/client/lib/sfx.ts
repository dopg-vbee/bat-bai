// Sound effects synthesised with Web Audio: no files to download, no licensing.

let context: AudioContext | null = null;
let output: AudioNode;

function audio(): AudioContext {
  if (!context) {
    context = new AudioContext();
    // Overlapping sounds (a burst of correct answers) are squeezed instead of clipping harshly.
    output = context.createDynamicsCompressor();
    output.connect(context.destination);
  }
  // Starts suspended until the page has had a click; the host has clicked "Bắt đầu" by now.
  if (context.state === 'suspended') void context.resume();
  return context;
}

const PENTATONIC = [0, 2, 4, 7, 9, 12];
const BASE_HZ = 523.25; // C5
const VOLUME = 0.22;
const CHIME_VOLUME = 0.12;
/** Answers landing closer than this share one chime. */
const CHIME_MIN_GAP_SEC = 0.09;
let lastChimeAt = -Infinity;

/**
 * Soft two-note "ting" for a correct answer. `step` walks up a pentatonic scale, so a burst
 * of correct answers climbs like an arpeggio instead of repeating the same beep.
 */
export function playCorrectChime(step = 0) {
  const ac = audio();
  if (ac.currentTime - lastChimeAt < CHIME_MIN_GAP_SEC) return;
  lastChimeAt = ac.currentTime;
  const root = BASE_HZ * 2 ** (PENTATONIC[step % PENTATONIC.length] / 12);
  note(ac, root, ac.currentTime, 0.4, CHIME_VOLUME, 'sine');
  note(ac, root * 1.5, ac.currentTime + 0.07, 0.4, CHIME_VOLUME * 0.7, 'sine');
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
  osc.connect(gain).connect(output);
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
