/**
 * grader.js — the on-device stroke-order engine.
 *
 * Because the game tells you WHICH kana to draw, we never have to classify a
 * mystery glyph. Instead we compare your strokes against the known KanjiVG
 * template and grade the things that actually matter pedagogically:
 *   1. stroke COUNT   — did you use the right number of strokes?
 *   2. stroke ORDER   — did you draw them in the canonical sequence?
 *   3. stroke DIRECTION — did each stroke go the right way?
 *   4. stroke SHAPE   — is each stroke roughly the right path?
 *
 * Everything here is plain geometry — no model, no network. ~Sub-millisecond.
 */

const SAMPLES = 16;          // must match tools/build-kana.mjs
const SHAPE_TOLERANCE = 0.30; // aligned-path distance (unit box) that scores ~0

// ── geometry helpers ────────────────────────────────────────────────────────

function resample(stroke, n = SAMPLES) {
  if (stroke.length === 1) return Array.from({ length: n }, () => [...stroke[0]]);
  // cumulative arc length
  const cum = [0];
  for (let i = 1; i < stroke.length; i++) {
    const dx = stroke[i][0] - stroke[i - 1][0];
    const dy = stroke[i][1] - stroke[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1] || 1e-9;
  const out = [];
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    let j = 1;
    while (j < cum.length - 1 && cum[j] < target) j++;
    const seg = cum[j] - cum[j - 1] || 1e-9;
    const t = (target - cum[j - 1]) / seg;
    out.push([
      stroke[j - 1][0] + (stroke[j][0] - stroke[j - 1][0]) * t,
      stroke[j - 1][1] + (stroke[j][1] - stroke[j - 1][1]) * t,
    ]);
  }
  return out;
}

// Fit a whole glyph (all strokes) into the unit box, preserving aspect ratio and
// centering it. This cancels out where/how big the user drew vs the template, so
// we compare shape + order, not absolute position.
function normalizeGlyph(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const [x, y] of s) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY;
  const span = Math.max(w, h) || 1e-9;
  const scale = 1 / span;
  const tx = (1 - w * scale) / 2;
  const ty = (1 - h * scale) / 2;
  return strokes.map((s) => s.map(([x, y]) => [(x - minX) * scale + tx, (y - minY) * scale + ty]));
}

function pathLength(stroke) {
  let L = 0;
  for (let i = 1; i < stroke.length; i++) {
    L += Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1]);
  }
  return L;
}

// Drop accidental specks — a tap or a 2px twitch the user can't even see, which
// would otherwise count as a stroke and trigger a false stroke-count penalty.
// Threshold is relative to the glyph's own size, so it's scale-independent.
function dropTinyStrokes(strokes) {
  const multi = strokes.filter((s) => s.length >= 2);
  if (!multi.length) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of multi) for (const [x, y] of s) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
  return multi.filter((s) => pathLength(s) >= 0.03 * diag);
}

// Dynamic Time Warping distance: instead of pairing points in lockstep (1st↔1st,
// 2nd↔2nd…), it finds the best flexible alignment between the two paths. So the
// SAME shape traced at a different pace or phase — e.g. lingering on の's loop —
// still matches, while a genuinely different path doesn't. Normalized by the
// sequence length so it's on the same scale as a per-point mean distance, which
// keeps SHAPE_TOLERANCE meaningful (for a perfectly aligned pair, DTW == mean).
function dtwDist(a, b) {
  const n = a.length, m = b.length;
  const d = (i, j) => Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1]);
  let prev = new Array(m + 1).fill(Infinity);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    const curr = new Array(m + 1).fill(Infinity);
    for (let j = 1; j <= m; j++) {
      curr[j] = d(i - 1, j - 1) + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[m] / n;
}

const reversed = (s) => [...s].reverse();

// Distance between two strokes, allowing the user to have drawn it backwards.
// Returns { dist, reversed }.
function strokeMatch(user, tmpl) {
  const fwd = dtwDist(user, tmpl);
  const rev = dtwDist(reversed(user), tmpl);
  return rev < fwd ? { dist: rev, reversed: true } : { dist: fwd, reversed: false };
}

// ── main entry ──────────────────────────────────────────────────────────────

/**
 * @param {number[][][]} templateStrokes  KanjiVG strokes (unit coords)
 * @param {number[][][]} userStrokesRaw    captured strokes, any coord space
 * @returns grade report
 */
export function grade(templateStrokes, userStrokesRaw) {
  const cleaned = dropTinyStrokes(userStrokesRaw); // ignore accidental specks
  const countExpected = templateStrokes.length;
  const countDrawn = cleaned.length;

  if (countDrawn === 0) {
    return { score: 0, pass: false, countExpected, countDrawn, strokes: [], issues: ['empty'],
             messages: ['Nothing drawn yet — give it a try!'] };
  }

  const tmpl = normalizeGlyph(templateStrokes.map((s) => resample(s)));
  const user = normalizeGlyph(cleaned.map((s) => resample(s)));

  // Greedy assignment: for each template stroke (in order), claim the nearest
  // not-yet-used user stroke. Tells us which user stroke "is" each template one,
  // independent of the order they were drawn.
  const used = new Set();
  const assign = tmpl.map((t) => {
    let best = -1, bestM = { dist: Infinity, reversed: false };
    user.forEach((u, ui) => {
      if (used.has(ui)) return;
      const m = strokeMatch(u, t);
      if (m.dist < bestM.dist) { best = ui; bestM = m; }
    });
    if (best >= 0) used.add(best);
    return { userIndex: best, ...bestM };
  });

  // Build per-stroke report keyed to the ORDER the user drew them.
  const strokes = [];
  const issues = new Set();
  if (countDrawn !== countExpected) issues.add('count');

  let shapeSum = 0;
  assign.forEach((a, tmplIndex) => {
    if (a.userIndex < 0) { issues.add('count'); return; }
    const shape = Math.max(0, 1 - a.dist / SHAPE_TOLERANCE);
    shapeSum += shape;
    const ordered = a.userIndex === tmplIndex;      // drawn in the right slot?
    if (!ordered) issues.add('order');
    if (a.reversed && shape > 0.4) issues.add('direction'); // reversed but recognizable
    if (shape < 0.45) issues.add('shape');
    strokes.push({
      templateIndex: tmplIndex,
      drawnIndex: a.userIndex,
      shape: +shape.toFixed(2),
      reversed: a.reversed,
      ordered,
      dist: +a.dist.toFixed(3),
    });
  });

  // Score: shape average is the backbone; order/direction/count chip away at it.
  const matched = strokes.length || 1;
  let score = (shapeSum / matched) * 100;
  if (issues.has('count')) score *= 0.6;
  if (issues.has('order')) score *= 0.75;
  if (issues.has('direction')) score *= 0.85;
  score = Math.round(Math.max(0, Math.min(100, score)));

  const messages = buildMessages(issues, countDrawn, countExpected, strokes, score);
  return { score, pass: score >= 70 && !issues.has('count'), countExpected, countDrawn,
           strokes, issues: [...issues], messages };
}

function buildMessages(issues, drawn, expected, strokes, score) {
  const msgs = [];
  if (issues.has('count')) {
    msgs.push(`You drew ${drawn} stroke${drawn === 1 ? '' : 's'}, but this kana has ${expected}.`);
  }
  if (issues.has('order')) {
    msgs.push('Right strokes, but the order was off — kana have a fixed stroke order.');
  }
  if (issues.has('direction')) {
    const rev = strokes.filter((s) => s.reversed).map((s) => s.templateIndex + 1);
    msgs.push(`Stroke ${rev.join(', ')} went the wrong direction (usually top→bottom, left→right).`);
  }
  if (issues.has('shape')) {
    const weak = strokes.filter((s) => s.shape < 0.45).map((s) => s.templateIndex + 1);
    if (weak.length) msgs.push(`Stroke ${weak.join(', ')} drifted from the shape — peek at the hint.`);
  }
  if (!msgs.length) {
    msgs.push(score >= 90 ? 'Clean. Right shape, right order, right direction. 🎉'
                          : 'Good — recognizable and in order. Tighten the shape for full marks.');
  }
  return msgs;
}

export { SAMPLES };
