/**
 * fretboard.js — SVG fretboard diagram (standard tuning, nut on the left,
 * high e string on top like a chord chart). Draws note / chord reveals.
 */
import { OPEN_STRINGS, FRET_COUNT, pc } from './theory.js';

const NS = 'http://www.w3.org/2000/svg';
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e']; // low to high
const MARKERS = [3, 5, 7, 9, 12];

const PAD_L = 44, PAD_R = 18, PAD_T = 22, PAD_B = 30;
const FRET_W = 54, STRING_GAP = 24;
const W = PAD_L + FRET_W * FRET_COUNT + PAD_R;
const H = PAD_T + STRING_GAP * 5 + PAD_B;

const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};

/** y coordinate for string index (0 = low E at bottom). */
const yOf = (s) => PAD_T + (5 - s) * STRING_GAP;
/** x coordinate of the finger position for a fret (0 = just left of the nut). */
const xOf = (f) => (f === 0 ? PAD_L - 14 : PAD_L + (f - 0.5) * FRET_W);

export function createFretboard(container, { onPluck } = {}) {
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fretboard', role: 'img',
    'aria-label': 'Guitar fretboard, 12 frets, standard tuning' });

  // Wood + nut
  svg.appendChild(el('rect', { x: PAD_L, y: PAD_T - 8, width: FRET_W * FRET_COUNT,
    height: STRING_GAP * 5 + 16, rx: 3, class: 'fb-wood' }));
  svg.appendChild(el('rect', { x: PAD_L - 4, y: PAD_T - 8, width: 5,
    height: STRING_GAP * 5 + 16, class: 'fb-nut' }));

  // Fret markers
  for (const f of MARKERS) {
    const x = PAD_L + (f - 0.5) * FRET_W;
    if (f === 12) {
      svg.appendChild(el('circle', { cx: x, cy: yOf(3.5), r: 5, class: 'fb-marker' }));
      svg.appendChild(el('circle', { cx: x, cy: yOf(1.5), r: 5, class: 'fb-marker' }));
    } else {
      svg.appendChild(el('circle', { cx: x, cy: yOf(2.5), r: 5, class: 'fb-marker' }));
    }
  }
  // Fret wires
  for (let f = 1; f <= FRET_COUNT; f++) {
    const x = PAD_L + f * FRET_W;
    svg.appendChild(el('line', { x1: x, y1: PAD_T - 8, x2: x, y2: PAD_T + STRING_GAP * 5 + 8, class: 'fb-fret' }));
    svg.appendChild(el('text', { x: x - FRET_W / 2, y: H - 10, class: 'fb-fretnum', 'text-anchor': 'middle' }, f));
  }
  // Strings (thicker for lower)
  for (let s = 0; s < 6; s++) {
    svg.appendChild(el('line', { x1: PAD_L - 4, y1: yOf(s), x2: PAD_L + FRET_W * FRET_COUNT, y2: yOf(s),
      class: 'fb-string', 'stroke-width': (2.4 - s * 0.3).toFixed(1) }));
    svg.appendChild(el('text', { x: 12, y: yOf(s) + 4, class: 'fb-strlabel' }, STRING_LABELS[s]));
  }

  // Click targets: one per (string, fret incl. open)
  const hits = el('g', { class: 'fb-hits' });
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= FRET_COUNT; f++) {
      const r = el('rect', {
        x: f === 0 ? PAD_L - 28 : PAD_L + (f - 1) * FRET_W,
        y: yOf(s) - STRING_GAP / 2, width: f === 0 ? 28 : FRET_W, height: STRING_GAP,
        class: 'fb-hit', 'data-s': s, 'data-f': f,
      });
      r.addEventListener('click', () => onPluck && onPluck({ string: s, fret: f, midi: OPEN_STRINGS[s] + f }));
      hits.appendChild(r);
    }
  }
  svg.appendChild(hits);

  const overlay = el('g', { class: 'fb-overlay' });
  svg.appendChild(overlay);
  container.appendChild(svg);

  function clear() { while (overlay.firstChild) overlay.removeChild(overlay.firstChild); }

  function dot(s, f, label, cls) {
    const g = el('g', { class: `fb-dot ${cls || ''}` });
    g.appendChild(el('circle', { cx: xOf(f), cy: yOf(s), r: 10.5 }));
    if (label) g.appendChild(el('text', { x: xOf(f), y: yOf(s) + 3.8, 'text-anchor': 'middle' }, label));
    overlay.appendChild(g);
    return g;
  }

  /**
   * Reveal a single note: `played` is the exact {string, fret}; `others` are the
   * other positions of the same pitch class, drawn faint.
   */
  function showNote(played, others, label) {
    clear();
    for (const p of others) {
      if (p.string === played.string && p.fret === played.fret) continue;
      dot(p.string, p.fret, label, 'fb-dot-echo');
    }
    dot(played.string, played.fret, label, 'fb-dot-hit');
  }

  /** Reveal a chord voicing (6-entry frets array, -1 = muted). */
  function showChord(frets, rootPc, labelFor) {
    clear();
    frets.forEach((f, s) => {
      if (f < 0) {
        overlay.appendChild(el('text', { x: PAD_L - 14, y: yOf(s) + 4, 'text-anchor': 'middle', class: 'fb-mute' }, '×'));
        return;
      }
      const p = pc(OPEN_STRINGS[s] + f);
      dot(s, f, labelFor ? labelFor(p) : '', p === rootPc ? 'fb-dot-root' : 'fb-dot-hit');
    });
    // Barre bar when 2+ strings share the lowest non-zero fret across a span
    const nonOpen = frets.filter(f => f > 0);
    if (nonOpen.length >= 4) {
      const minF = Math.min(...nonOpen);
      const idx = frets.map((f, s) => (f === minF ? s : -1)).filter(s => s >= 0);
      if (idx.length >= 3) {
        const lo = Math.min(...idx), hi = Math.max(...idx);
        overlay.insertBefore(el('rect', { x: xOf(minF) - 8, y: yOf(hi) - 9, width: 16,
          height: yOf(lo) - yOf(hi) + 18, rx: 8, class: 'fb-barre' }), overlay.firstChild);
      }
    }
  }

  /**
   * Reveal for Find-it mode: every position with the exact pitch is correct
   * (green); other positions of the pitch class are faint; the tap is marked
   * red if it missed.
   */
  function showLocate(correctPositions, others, tapped, label, tapLabel) {
    clear();
    const isCorrect = (p) => correctPositions.some(c => c.string === p.string && c.fret === p.fret);
    for (const p of others) if (!isCorrect(p)) dot(p.string, p.fret, label, 'fb-dot-echo');
    for (const p of correctPositions) dot(p.string, p.fret, label, 'fb-dot-hit');
    if (tapped && !isCorrect(tapped)) dot(tapped.string, tapped.fret, tapLabel, 'fb-dot-miss');
  }

  /** Brief flash on a plucked position (explore mode). */
  function flash(s, f, label) {
    const g = dot(s, f, label, 'fb-dot-flash');
    setTimeout(() => g.remove(), 900);
  }

  return { clear, showNote, showChord, showLocate, flash };
}
