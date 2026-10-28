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

/** Three soft bells stepping down: "that's the end", short and unlike the podium's drums and fanfare. */
export function playGameOver() {
  const ac = audio();
  [783.99, 659.25, 523.25].forEach((hz, i) => note(ac, hz, ac.currentTime + i * 0.2, 0.7, CHIME_VOLUME * 1.4, 'sine')); // G5 E5 C5
}

/** Short victory fanfare: four quick rising notes, then a ringing major chord. */
export function playFanfare() {
  const ac = audio();
  const now = ac.currentTime;
  FANFARE_NOTES.forEach((hz, i) => note(ac, hz, now + i * 0.11, 0.18, VOLUME, 'square'));
  const chordAt = now + FANFARE_NOTES.length * 0.11 + 0.04;
  FANFARE_NOTES.forEach((hz) => note(ac, hz, chordAt, 1.1, VOLUME * 0.55, 'triangle'));
}

let noise: AudioBuffer | null = null;

/** A short buffer of white noise, looped or cut as needed. */
function whiteNoise(ac: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate * 0.1, ac.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** Airy sweep as the spotlight swings to a new place. */
export function playWhoosh() {
  const ac = audio();
  const now = ac.currentTime;
  const source = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  source.buffer = whiteNoise(ac);
  source.loop = true;
  filter.type = 'bandpass';
  filter.Q.value = 1.5;
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(2400, now + 0.45);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(VOLUME * 0.6, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  source.connect(filter).connect(gain).connect(output);
  source.start(now);
  source.stop(now + 0.6);
}

/** Snare roll that swells for `seconds`, building up to a reveal. */
export function playDrumroll(seconds: number) {
  const ac = audio();
  const buffer = whiteNoise(ac);
  const snare = ac.createBiquadFilter();
  snare.type = 'bandpass';
  snare.frequency.value = 1800;
  snare.connect(output);
  const now = ac.currentTime;
  for (let t = 0; t < seconds; t += 0.045) {
    const hit = ac.createBufferSource();
    const gain = ac.createGain();
    hit.buffer = buffer;
    gain.gain.setValueAtTime(VOLUME * (0.3 + (0.7 * t) / seconds), now + t);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.06);
    hit.connect(gain).connect(snare);
    hit.start(now + t);
    hit.stop(now + t + 0.08);
  }
}

/** Low thump plus a major chord as 3rd (lower) or 2nd place appears; the winner gets the fanfare. */
export function playPodiumHit(place: number) {
  const ac = audio();
  const root = place === 2 ? 392 : 523.25; // G4 / C5
  note(ac, 110, ac.currentTime, 0.35, VOLUME, 'sine');
  [1, 1.26, 1.5].forEach((ratio) => note(ac, root * ratio, ac.currentTime, 0.9, VOLUME * 0.45, 'triangle'));
}
