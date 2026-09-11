/**
 * audio.js — plucked-string synthesis with Web Audio.
 *
 * Uses the Karplus-Strong algorithm (a noise burst fed through a tuned,
 * low-passed delay line). No samples, no downloads: every note is rendered
 * into an AudioBuffer on demand and cached by MIDI number.
 */
import { midiToFreq } from './theory.js';

let ctx = null;
const cache = new Map();

export function audioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Render one plucked string into a mono AudioBuffer. */
function renderPluck(midi, seconds = 2.6) {
  const ac = audioContext();
  const sr = ac.sampleRate;
  const freq = midiToFreq(midi);
  const n = Math.floor(sr * seconds);
  const buf = ac.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);

  // Loop period in samples. The averaging filter below adds half a sample of
  // delay, and the interpolated read adds (1 - frac), so size the line so the
  // total round trip is exactly one period -- otherwise high notes go flat.
  const period = sr / freq;
  const D = period - 0.5;
  const len = Math.max(2, Math.floor(D) + 1);
  const frac = len - D; // in (0, 1]
  const line = new Float32Array(len);

  // Excitation: white noise, lightly low-passed so the attack is not fizzy.
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    prev = 0.5 * w + 0.5 * prev;
    line[i] = prev;
  }

  // Loss is applied once per round trip, i.e. `freq` times a second, so derive
  // it from a target half-life: low strings ring ~1.4 s, high strings ~0.8 s.
  const halfLife = 1.4 - 0.6 * Math.min(1, Math.max(0, (freq - 80) / 580));
  const decay = Math.pow(0.5, 1 / (freq * halfLife));
  let idx = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const a = line[idx];               // oldest sample (age len)
    const b = line[(idx + 1) % len];   // one sample younger
    const s = a * (1 - frac) + b * frac; // effective delay = len - frac
    out[i] = s;
    // Classic KS two-point average (low-pass) + per-trip loss.
    line[idx] = decay * 0.5 * (s + lp);
    lp = s;
    idx = (idx + 1) % len;
  }

  // Gentle fade-out so the tail never clicks.
  const fade = Math.floor(sr * 0.08);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  // Normalise.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] /= peak;
  return buf;
}

export function bufferFor(midi) {
  if (!cache.has(midi)) cache.set(midi, renderPluck(midi));
  return cache.get(midi);
}

/** Play a single note. `when` is an absolute AudioContext time (default now). */
export function playNote(midi, { when = 0, gain = 0.5 } = {}) {
  const ac = audioContext();
  const src = ac.createBufferSource();
  src.buffer = bufferFor(midi);
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ac.destination);
  src.start(when || ac.currentTime);
}

/** Strum a set of MIDI notes low-to-high with a small delay between strings. */
export function playChord(midis, { strumMs = 45, gain = 0.32 } = {}) {
  const ac = audioContext();
  const t0 = ac.currentTime + 0.02;
  midis.forEach((m, i) => playNote(m, { when: t0 + (i * strumMs) / 1000, gain }));
}

/** Play a short tonic cadence (I chord) as a key reference. */
export function playReference(midis) {
  playChord(midis, { strumMs: 30, gain: 0.26 });
}
