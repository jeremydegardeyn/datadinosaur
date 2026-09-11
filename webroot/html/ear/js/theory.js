/**
 * theory.js — pitch classes, keys, diatonic chords, and guitar voicings.
 * Pure data + functions; no DOM, no audio.
 */

export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Standard tuning, low to high, as MIDI numbers. Index 0 = low E (6th string).
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];
export const FRET_COUNT = 12;

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const pc = (midi) => ((midi % 12) + 12) % 12;

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
// Diatonic triad qualities by degree.
const MAJOR_QUAL = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const MINOR_QUAL = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_ROMAN = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
const DEGREE_LABEL = ['1', '2', '3', '4', '5', '6', '7'];

// Keys whose conventional spelling uses flats.
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export const KEY_LIST = [
  { id: 'C',  label: 'C major' },  { id: 'G',  label: 'G major' },  { id: 'D',  label: 'D major' },
  { id: 'A',  label: 'A major' },  { id: 'E',  label: 'E major' },  { id: 'B',  label: 'B major' },
  { id: 'F#', label: 'F# major' }, { id: 'Db', label: 'Db major' }, { id: 'Ab', label: 'Ab major' },
  { id: 'Eb', label: 'Eb major' }, { id: 'Bb', label: 'Bb major' }, { id: 'F',  label: 'F major' },
  { id: 'Am', label: 'A minor' },  { id: 'Em', label: 'E minor' },  { id: 'Bm', label: 'B minor' },
  { id: 'F#m', label: 'F# minor' },{ id: 'C#m', label: 'C# minor' },{ id: 'G#m', label: 'G# minor' },
  { id: 'Dm', label: 'D minor' },  { id: 'Gm', label: 'G minor' },  { id: 'Cm', label: 'C minor' },
  { id: 'Fm', label: 'F minor' },  { id: 'Bbm', label: 'Bb minor' },{ id: 'Ebm', label: 'Eb minor' },
  { id: 'chromatic', label: 'Chromatic (all 12)' },
];

function nameToPc(name) {
  let i = NOTE_NAMES_SHARP.indexOf(name);
  if (i < 0) i = NOTE_NAMES_FLAT.indexOf(name);
  return i;
}

/** Spell a pitch class in the context of a key. */
export function spell(pcVal, key) {
  return (key.flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pcVal];
}

/**
 * Build a key object:
 * { id, label, tonic, minor, flats, chromatic, degrees:[{pc,name,degree}], chords:[{root,quality,name,roman}] }
 */
export function buildKey(id) {
  const entry = KEY_LIST.find(k => k.id === id) || KEY_LIST[0];
  if (entry.id === 'chromatic') {
    const key = { id: entry.id, label: entry.label, tonic: 0, minor: false, flats: false, chromatic: true };
    key.degrees = NOTE_NAMES_SHARP.map((n, i) => ({ pc: i, name: n, degree: '' }));
    key.chords = [];
    for (let r = 0; r < 12; r++) {
      key.chords.push({ root: r, quality: 'maj', name: NOTE_NAMES_SHARP[r], roman: '' });
      key.chords.push({ root: r, quality: 'min', name: NOTE_NAMES_SHARP[r] + 'm', roman: '' });
    }
    return key;
  }
  const minor = entry.id.endsWith('m');
  const tonicName = minor ? entry.id.slice(0, -1) : entry.id;
  const tonic = nameToPc(tonicName);
  const flats = FLAT_KEYS.has(entry.id);
  const steps = minor ? MINOR_STEPS : MAJOR_STEPS;
  const key = { id: entry.id, label: entry.label, tonic, minor, flats, chromatic: false };
  key.degrees = steps.map((s, i) => {
    const p = (tonic + s) % 12;
    return { pc: p, name: spell(p, key), degree: DEGREE_LABEL[i] };
  });
  const quals = minor ? MINOR_QUAL : MAJOR_QUAL;
  const romans = minor ? MINOR_ROMAN : MAJOR_ROMAN;
  key.chords = steps.map((s, i) => {
    const root = (tonic + s) % 12;
    const q = quals[i];
    return { root, quality: q, name: chordName(spell(root, key), q), roman: romans[i] };
  });
  return key;
}

export function chordName(rootName, quality) {
  return rootName + (quality === 'min' ? 'm' : quality === 'dim' ? '°' : '');
}

export const CHORD_INTERVALS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] };

/** Every (string, fret) position within FRET_COUNT whose pitch class matches. */
export function positionsForPc(p) {
  const out = [];
  OPEN_STRINGS.forEach((open, s) => {
    for (let f = 0; f <= FRET_COUNT; f++) if (pc(open + f) === p) out.push({ string: s, fret: f });
  });
  return out;
}

/* ---------- chord voicings ----------
 * A voicing is an array of 6 entries low-to-high: fret number, or -1 for muted.
 * Open shapes are fixed; movable shapes give the root string and a fret
 * pattern relative to the root fret (null = muted).
 */
const OPEN_SHAPES = [
  { root: 0,  quality: 'maj', frets: [-1, 3, 2, 0, 1, 0] },  // C
  { root: 7,  quality: 'maj', frets: [3, 2, 0, 0, 0, 3] },   // G
  { root: 2,  quality: 'maj', frets: [-1, -1, 0, 2, 3, 2] }, // D
  { root: 2,  quality: 'min', frets: [-1, -1, 0, 2, 3, 1] }, // Dm
  { root: 9,  quality: 'maj', frets: [-1, 0, 2, 2, 2, 0] },  // A
  { root: 9,  quality: 'min', frets: [-1, 0, 2, 2, 1, 0] },  // Am
  { root: 4,  quality: 'maj', frets: [0, 2, 2, 1, 0, 0] },   // E
  { root: 4,  quality: 'min', frets: [0, 2, 2, 0, 0, 0] },   // Em
];
const MOVABLE_SHAPES = [
  { rootString: 0, quality: 'maj', rel: [0, 2, 2, 1, 0, 0] },        // E-shape barre
  { rootString: 0, quality: 'min', rel: [0, 2, 2, 0, 0, 0] },        // Em-shape barre
  { rootString: 1, quality: 'maj', rel: [null, 0, 2, 2, 2, 0] },     // A-shape barre
  { rootString: 1, quality: 'min', rel: [null, 0, 2, 2, 1, 0] },     // Am-shape barre
  { rootString: 1, quality: 'dim', rel: [null, 0, 1, 2, 1, null] },  // x R b5 R b3 x
  { rootString: 0, quality: 'dim', rel: [0, 1, 2, 0, null, null] },     // R b5 R b3 (Edim shape)
];

/** All voicings (6-entry fret arrays) for a chord that fit on the fretboard. */
export function voicingsFor(root, quality) {
  const out = [];
  for (const s of OPEN_SHAPES) if (s.root === root && s.quality === quality) out.push(s.frets.slice());
  for (const m of MOVABLE_SHAPES) {
    if (m.quality !== quality) continue;
    const rootFret = ((root - pc(OPEN_STRINGS[m.rootString])) % 12 + 12) % 12;
    if (rootFret === 0 && quality !== 'dim') continue; // the open shape already covers it
    const frets = m.rel.map(r => (r === null ? -1 : r + rootFret));
    if (Math.max(...frets) <= FRET_COUNT) out.push(frets);
  }
  return out;
}

export function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** MIDI notes of a voicing, low to high (skips muted strings). */
export function voicingMidi(frets) {
  return frets.map((f, s) => (f < 0 ? null : OPEN_STRINGS[s] + f)).filter(m => m !== null);
}
