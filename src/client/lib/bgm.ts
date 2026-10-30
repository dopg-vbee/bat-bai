// Gentle background music for the host screen and home page, synthesised with Web Audio: no files, no licensing.
// An eight-bar loop (C Am F G, C Em F G): soft chord pads, a quiet bass and a singable melody on top.

const BPM = 84;
const EIGHTH_SEC = 60 / BPM / 2;
const STEPS_PER_BAR = 8;
/** The scheduler wakes this often and queues notes up to LOOKAHEAD_SEC ahead. */
const TICK_MS = 50;
const LOOKAHEAD_SEC = 0.25;
const MASTER_VOLUME = 0.22;
const FADE_SEC = 1.2;

const C5 = 523.25;
const semitones = (n: number) => C5 * 2 ** (n / 12);

/** Bass root per bar, in semitones from C5. */
const BASS = [-24, -27, -31, -29, -24, -20, -31, -29];
/** Pad chord per bar, in semitones from C5. */
const PADS = [
  [-12, -8, -5],
  [-15, -12, -8],
  [-19, -15, -12],
  [-17, -13, -10],
  [-12, -8, -5],
  [-20, -17, -13],
  [-19, -15, -12],
  [-17, -13, -10],
];
/** Melody per bar: [step in the bar, semitones from C5, length in steps]. */
const MELODY: [number, number, number][][] = [
  [[0, 7, 3], [3, 4, 1], [4, 7, 2], [6, 9, 2]],
  [[0, 12, 3], [3, 9, 1], [4, 7, 2], [6, 4, 2]],
  [[0, 5, 3], [3, 9, 1], [4, 12, 2], [6, 9, 2]],
  [[0, 7, 4], [4, 2, 2], [6, 4, 2]],
  [[0, 4, 2], [2, 7, 2], [4, 12, 3], [7, 11, 1]],
  [[0, 9, 3], [3, 7, 1], [4, 4, 4]],
  [[0, 5, 2], [2, 9, 2], [4, 12, 2], [6, 14, 2]],
  [[0, 12, 3], [3, 11, 1], [4, 7, 4]],
];

let context: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let nextStepAt = 0;
let step = 0;

function setup(): AudioContext {
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0;
    // Rounds off the edges of the waves so the loop stays soft over a long time.
    const soften = context.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 2400;
    const squeeze = context.createDynamicsCompressor();
    master.connect(soften).connect(squeeze).connect(context.destination);
  }
  return context;
}

function tone(ac: AudioContext, hz: number, at: number, length: number, volume: number, type: OscillatorType, attack: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + attack);
  gain.gain.setValueAtTime(volume, at + Math.max(attack, length - 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

function playStep(ac: AudioContext, index: number, at: number) {
  const bar = Math.floor(index / STEPS_PER_BAR) % MELODY.length;
  const beat = index % STEPS_PER_BAR;
  if (beat === 0) {
    const barSec = EIGHTH_SEC * STEPS_PER_BAR;
    PADS[bar].forEach((n) => tone(ac, semitones(n), at, barSec, 0.05, 'sine', 0.5));
  }
  if (beat === 0 || beat === 4) tone(ac, semitones(BASS[bar]), at, EIGHTH_SEC * 3.5, 0.16, 'sine', 0.03);
  for (const [start, n, len] of MELODY[bar]) {
    if (start !== beat) continue;
    const hz = semitones(n);
    tone(ac, hz, at, EIGHTH_SEC * len * 0.95, 0.13, 'triangle', 0.03);
    tone(ac, hz * 2, at, EIGHTH_SEC * len * 0.6, 0.015, 'sine', 0.03);
  }
}

function tick() {
  const ac = context;
  if (!ac) return;
  while (nextStepAt < ac.currentTime + LOOKAHEAD_SEC) {
    playStep(ac, step, Math.max(nextStepAt, ac.currentTime));
    nextStepAt += EIGHTH_SEC;
    step++;
  }
}

/** Browsers keep audio suspended until the page has been tapped; the first tap wakes it. */
function resumeOnGesture(ac: AudioContext) {
  const resume = () => void ac.resume();
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
}

/** Fades the loop in (and starts it if it was stopped). Safe to call again while it plays. */
export function startMusic() {
  const ac = setup();
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (ac.state === 'suspended') {
    void ac.resume();
    resumeOnGesture(ac);
  }
  master!.gain.cancelScheduledValues(ac.currentTime);
  master!.gain.setValueAtTime(master!.gain.value, ac.currentTime);
  master!.gain.linearRampToValueAtTime(MASTER_VOLUME, ac.currentTime + FADE_SEC);
  if (timer) return;
  step = 0;
  nextStepAt = ac.currentTime + 0.1;
  timer = setInterval(tick, TICK_MS);
}

/** Fades the loop out, then halts the scheduler. */
export function stopMusic() {
  const ac = context;
  if (!ac || !master || !timer) return;
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setValueAtTime(master.gain.value, ac.currentTime);
  master.gain.linearRampToValueAtTime(0, ac.currentTime + FADE_SEC);
  stopTimer = setTimeout(() => {
    if (timer) clearInterval(timer);
    timer = null;
    stopTimer = null;
  }, FADE_SEC * 1000 + 100);
}
