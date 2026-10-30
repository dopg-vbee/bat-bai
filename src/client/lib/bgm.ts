// Cheerful background music for the host screen, synthesised with Web Audio: no files, no licensing.
// A four-bar loop (C - G - Am - F) with a bouncy pentatonic tune, a bass and a light off-beat hat.

const BPM = 126;
const EIGHTH_SEC = 60 / BPM / 2;
const STEPS_PER_BAR = 8;
/** The scheduler wakes this often and queues notes up to LOOKAHEAD_SEC ahead. */
const TICK_MS = 50;
const LOOKAHEAD_SEC = 0.2;
const MASTER_VOLUME = 0.3;
const FADE_SEC = 0.7;

const C5 = 523.25;
const semitones = (hz: number, n: number) => hz * 2 ** (n / 12);

/** Bass root per bar, in Hz: C G A F. */
const BASS = [130.81, 98, 110, 87.31];
/** Melody as semitones above C5 (null = rest), one row per bar of the same chords. */
const MELODY: (number | null)[][] = [
  [4, null, 7, 4, 9, null, 7, null],
  [9, 7, 2, null, 7, null, 4, 2],
  [4, null, 9, null, 12, 9, 7, 4],
  [9, null, 12, 9, 7, null, 4, null],
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
    const squeeze = context.createDynamicsCompressor();
    master.connect(squeeze).connect(context.destination);
    noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.1), context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return context;
}

function pluck(ac: AudioContext, hz: number, at: number, length: number, volume: number, type: OscillatorType) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

function hat(ac: AudioContext, at: number, volume: number) {
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = noise;
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  src.connect(filter).connect(gain).connect(master!);
  src.start(at);
}

function playStep(ac: AudioContext, index: number, at: number) {
  const bar = Math.floor(index / STEPS_PER_BAR) % MELODY.length;
  const beat = index % STEPS_PER_BAR;
  const bass = BASS[bar];
  if (beat % 4 === 0) pluck(ac, bass, at, EIGHTH_SEC * 3.2, 0.32, 'triangle');
  else if (beat % 4 === 2) pluck(ac, bass * 1.5, at, EIGHTH_SEC * 1.6, 0.2, 'triangle');
  const tune = MELODY[bar][beat];
  if (tune !== null) {
    const hz = semitones(C5, tune);
    pluck(ac, hz, at, EIGHTH_SEC * 1.8, 0.2, 'triangle');
    pluck(ac, hz * 2, at, EIGHTH_SEC * 0.9, 0.05, 'sine');
  }
  if (beat % 2 === 1) hat(ac, at, 0.05);
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
