// Cheerful background music for the host screen and home page, synthesised with Web Audio: no files, no licensing.
// An eight-bar loop (C G Am F, C G F G): a bouncy bass, off-beat chord stabs, a soft kick and shaker,
// a bright staccato tune on top, and brass stabs that answer it. Round waves and a low-pass filter keep it sunny rather than shrill.

const BPM = 112;
const EIGHTH_SEC = 60 / BPM / 2;
const STEPS_PER_BAR = 8;
/** The scheduler wakes this often and queues notes up to LOOKAHEAD_SEC ahead. */
const TICK_MS = 50;
const LOOKAHEAD_SEC = 0.25;
const MASTER_VOLUME = 0.26;
const FADE_SEC = 1;

const C5 = 523.25;
const semitones = (n: number) => C5 * 2 ** (n / 12);

/** Bass root per bar, in semitones from C5. */
const BASS = [-24, -29, -27, -31, -24, -29, -31, -29];
/** Chord per bar for the off-beat stabs, in semitones from C5. */
const CHORDS = [
  [-12, -8, -5],
  [-5, -1, 2],
  [-3, 0, 4],
  [-7, -3, 0],
  [-12, -8, -5],
  [-5, -1, 2],
  [-7, -3, 0],
  [-5, -1, 2],
];
/** Melody per bar: [step in the bar, semitones from C5, length in steps]. */
const MELODY: [number, number, number][][] = [
  [[0, 4, 1], [1, 7, 1], [2, 12, 2], [4, 11, 1], [5, 12, 1], [6, 7, 2]],
  [[0, 2, 1], [1, 7, 1], [2, 11, 2], [4, 9, 1], [5, 11, 1], [6, 7, 2]],
  [[0, 4, 1], [1, 9, 1], [2, 12, 2], [4, 9, 1], [5, 12, 1], [6, 16, 2]],
  [[0, 5, 1], [1, 9, 1], [2, 12, 2], [4, 9, 1], [5, 7, 1], [6, 5, 2]],
  [[0, 4, 1], [1, 7, 1], [2, 12, 2], [4, 14, 1], [5, 12, 1], [6, 16, 2]],
  [[0, 14, 2], [2, 11, 1], [3, 7, 1], [4, 2, 1], [5, 7, 1], [6, 11, 2]],
  [[0, 12, 2], [2, 9, 1], [3, 12, 1], [4, 17, 2], [6, 16, 1], [7, 14, 1]],
  [[0, 14, 1], [1, 11, 1], [2, 7, 2], [4, 11, 1], [5, 14, 1], [6, 7, 2]],
];

/** Brass stabs per bar: [step in the bar, chord in semitones from C5, length in steps]. */
const BRASS: [number, number[], number][][] = [
  [[0, [-5, 0], 2]],
  [],
  [[0, [-3, 4], 2]],
  [[6, [5, 9], 1], [7, [5, 9], 1]],
  [[0, [-5, 0], 2]],
  [],
  [[0, [-7, 0], 2]],
  [[6, [7, 11], 1], [7, [7, 11], 1]],
];

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let nextStepAt = 0;
let step = 0;

function setup(): AudioContext {
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0;
    const soften = context.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 3200;
    const squeeze = context.createDynamicsCompressor();
    master.connect(soften).connect(squeeze).connect(context.destination);
    noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.1), context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return context;
}

/** A short, round note: quick attack, then a fade to silence. */
function pluck(ac: AudioContext, hz: number, at: number, length: number, volume: number, type: OscillatorType) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** A trumpet-like stab: two slightly detuned saws whose filter opens fast, like a brass player's attack. */
function brass(ac: AudioContext, hz: number, at: number, length: number, volume: number) {
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  filter.type = 'lowpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(500, at);
  filter.frequency.exponentialRampToValueAtTime(2600, at + 0.07);
  filter.frequency.exponentialRampToValueAtTime(900, at + length);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.03);
  gain.gain.setValueAtTime(volume, at + Math.max(0.03, length - 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  filter.connect(gain).connect(master!);
  for (const detune of [-7, 7]) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = hz;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

/** A soft thump: a sine sliding down in pitch. */
function kick(ac: AudioContext, at: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.frequency.setValueAtTime(130, at);
  osc.frequency.exponentialRampToValueAtTime(48, at + 0.12);
  gain.gain.setValueAtTime(0.22, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + 0.25);
}

/** A whisper of band-passed noise on the off-beats. */
function shaker(ac: AudioContext, at: number) {
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = noise;
  filter.type = 'bandpass';
  filter.frequency.value = 5000;
  gain.gain.setValueAtTime(0.03, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  src.connect(filter).connect(gain).connect(master!);
  src.start(at);
}

function playStep(ac: AudioContext, index: number, at: number) {
  const bar = Math.floor(index / STEPS_PER_BAR) % MELODY.length;
  const beat = index % STEPS_PER_BAR;
  if (beat % 4 === 0) kick(ac, at);
  if (beat % 2 === 1) shaker(ac, at);
  // Bass bounces between the root and the octave above it.
  const bass = semitones(BASS[bar]);
  if (beat === 0 || beat === 4) pluck(ac, bass, at, EIGHTH_SEC * 1.8, 0.2, 'triangle');
  else if (beat === 3 || beat === 7) pluck(ac, bass * 2, at, EIGHTH_SEC * 0.9, 0.12, 'triangle');
  // Off-beat chord stabs.
  if (beat === 2 || beat === 6) CHORDS[bar].forEach((n) => pluck(ac, semitones(n), at, EIGHTH_SEC * 1.1, 0.04, 'triangle'));
  for (const [start, chord, len] of BRASS[bar]) {
    if (start === beat) chord.forEach((n) => brass(ac, semitones(n), at, EIGHTH_SEC * len * 0.9, 0.05));
  }
  for (const [start, n, len] of MELODY[bar]) {
    if (start !== beat) continue;
    const hz = semitones(n);
    pluck(ac, hz, at, EIGHTH_SEC * len * 0.8, 0.12, 'triangle');
    pluck(ac, hz * 2, at, EIGHTH_SEC * len * 0.5, 0.02, 'sine');
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
