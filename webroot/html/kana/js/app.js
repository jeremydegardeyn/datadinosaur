import { grade } from './grader.js';
import { SRS } from './srs.js';
import { mnemonic, review } from './sensei.js';

const $ = (id) => document.getElementById(id);
const PAD = 18;

let KANA = {};
let srs;
let drill = 'write';   // write | read | hira2kata | kata2hira
let script = 'hiragana'; // hiragana | katakana | both  (only used by write/read)
let current = null;    // the kana being ASKED about (SRS subject + cue glyph for read/cross)
let target = null;     // the kana to DRAW (draw drills) or whose reading to TYPE (read)
let strokes = [];
let drawing = false;
let checked = false;

// romaji variants accepted when typing the sound (read drill)
const READING_ALIASES = {
  shi: ['shi', 'si'], chi: ['chi', 'ti'], tsu: ['tsu', 'tu'], fu: ['fu', 'hu'],
  ji: ['ji', 'zi'], dji: ['ji', 'di', 'dji'], dzu: ['zu', 'du', 'dzu'],
  wo: ['wo', 'o'], n: ['n', 'nn'],
};
const aliases = (r) => READING_ALIASES[r] || [r];
const pretty = (r) => ({ dji: 'ji', dzu: 'zu' }[r] || r); // friendlier display for ぢ/づ

// hiragana <-> katakana share readings with a fixed +0x60 codepoint offset
function counterpart(ch) {
  const cp = ch.codePointAt(0);
  const other = cp >= 0x30a1 ? cp - 0x60 : cp + 0x60;
  const c = String.fromCodePoint(other);
  return KANA[c] ? c : null;
}

// ── boot ────────────────────────────────────────────────────────────────────
(async function init() {
  KANA = await fetch('./js/kana-data.json').then((r) => r.json());
  srs = new SRS(Object.keys(KANA));
  setupCanvas();
  setupControls();
  setDrill('write');
})();

function pool() {
  if (drill === 'hira2kata') return Object.keys(KANA).filter((c) => KANA[c].type === 'hiragana');
  if (drill === 'kata2hira') return Object.keys(KANA).filter((c) => KANA[c].type === 'katakana');
  return Object.keys(KANA).filter((c) => script === 'both' || KANA[c].type === script);
}

// ── canvas + drawing ─────────────────────────────────────────────────────────
let ctx, size;
function setupCanvas() {
  const cv = $('pad');
  size = cv.width;
  ctx = cv.getContext('2d');
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return [
      Math.max(0, Math.min(size, ((e.clientX - r.left) / r.width) * size)),
      Math.max(0, Math.min(size, ((e.clientY - r.top) / r.height) * size)),
    ];
  };
  cv.addEventListener('pointerdown', (e) => {
    if (checked) return;
    cv.setPointerCapture(e.pointerId);
    drawing = true; strokes.push([pos(e)]); render();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drawing) return; strokes[strokes.length - 1].push(pos(e)); render();
  });
  const end = () => { drawing = false; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  render();
}

function render(ghost = null) {
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(120,130,150,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
  ctx.stroke();
  ctx.setLineDash([4, 6]); ctx.strokeRect(PAD, PAD, size - 2 * PAD, size - 2 * PAD); ctx.setLineDash([]);
  if (ghost) drawGhost(ghost);
  ctx.strokeStyle = '#1f6feb'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.length) continue;
    ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
    for (const [x, y] of s) ctx.lineTo(x, y);
    ctx.stroke();
  }
}

// ── hint: animate the canonical strokes of the TARGET kana ───────────────────
let hintTimer = null;
function showHint() {
  if (!target || drill === 'read') return;
  cancelAnimationFrame(hintTimer);
  const tmpl = KANA[target].strokes.map((s) => s.map(([x, y]) => [x * size, y * size]));
  const start = performance.now();
  const perStroke = 520, gap = 160, total = tmpl.length * (perStroke + gap);
  const frame = (now) => {
    const t = (now - start) % total;
    let acc = 0, parts = [];
    for (let i = 0; i < tmpl.length; i++) {
      const s = acc, e = acc + perStroke;
      if (t >= e + gap) parts.push({ stroke: tmpl[i], frac: 1, idx: i });
      else if (t >= s) { parts.push({ stroke: tmpl[i], frac: Math.min(1, (t - s) / perStroke), idx: i }); break; }
      acc = e + gap;
    }
    render(parts);
    hintTimer = requestAnimationFrame(frame);
  };
  hintTimer = requestAnimationFrame(frame);
  setTimeout(() => { cancelAnimationFrame(hintTimer); render(); }, total * 2 + 200);
}

function drawGhost(parts) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 10;
  for (const { stroke, frac, idx } of parts) {
    const n = Math.max(2, Math.floor(stroke.length * frac));
    ctx.strokeStyle = 'rgba(220,80,120,0.45)';
    ctx.beginPath(); ctx.moveTo(stroke[0][0], stroke[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(stroke[i][0], stroke[i][1]);
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,80,120,0.9)';
    ctx.beginPath(); ctx.arc(stroke[0][0], stroke[0][1], 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), stroke[0][0], stroke[0][1]);
  }
}

// ── flow ─────────────────────────────────────────────────────────────────────
function nextKana() {
  cancelAnimationFrame(hintTimer);
  current = srs.next(pool());
  target = (drill === 'hira2kata' || drill === 'kata2hira') ? counterpart(current) : current;
  strokes = []; checked = false;

  const info = KANA[current];
  const cueMain = $('cueMain'), cueSub = $('cueSub'), cueLabel = $('cueLabel');

  if (drill === 'write') {
    cueLabel.textContent = `Draw the ${script === 'both' ? 'kana' : script} for`;
    cueMain.textContent = pretty(info.reading);
    cueMain.className = 'cue-romaji';
    cueSub.textContent = '';
  } else if (drill === 'read') {
    cueLabel.textContent = `Type the sound of this ${info.type}`;
    cueMain.textContent = current;
    cueMain.className = 'cue-glyph';
    cueSub.textContent = '';
  } else {
    const from = drill === 'hira2kata' ? 'hiragana' : 'katakana';
    const to = drill === 'hira2kata' ? 'katakana' : 'hiragana';
    cueLabel.textContent = `Draw the ${to} for this ${from}`;
    cueMain.textContent = current;
    cueMain.className = 'cue-glyph';
    cueSub.textContent = pretty(info.reading);
  }

  $('reveal').textContent = ''; $('reveal').classList.remove('show');
  $('answerInput').value = '';
  $('readResult').textContent = '';
  $('feedback').classList.add('hidden');
  $('senseiCard').classList.add('hidden');
  $('checkBtn').disabled = false;
  $('nextBtn').classList.add('hidden');
  render();
  if (drill === 'read') setTimeout(() => $('answerInput').focus(), 0);
  updateProgress();
}

function clearPad() { if (checked) return; strokes = []; render(); }
function undo() { if (checked) return; strokes.pop(); render(); }

function check() {
  if (checked) return;
  if (drill === 'read') return checkRead();
  return checkDraw();
}

function checkDraw() {
  if (!strokes.length) return;
  cancelAnimationFrame(hintTimer);
  finishTurn();
  const report = grade(KANA[target].strokes, strokes);
  srs.record(current, report.pass, report.score);
  const rev = $('reveal'); rev.textContent = target; rev.classList.add('show');
  renderFeedback(report);
  updateProgress();
}

function checkRead() {
  const raw = $('answerInput').value.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!raw) return;
  finishTurn();
  const ok = aliases(KANA[target].reading).includes(raw);
  srs.record(current, ok, ok ? 100 : 0);
  $('readResult').innerHTML =
    `<span class="big">${current}</span> = <span class="rd">${pretty(KANA[target].reading)}</span>` +
    (ok ? ' ✓' : ` — you wrote “${raw}”`);
  $('readResult').className = ok ? 'read-result good' : 'read-result bad';
  renderFeedback({ score: ok ? 100 : 0, strokes: [],
    messages: [ok ? 'Correct! 🎉' : `Not quite — listen and try to remember the shape→sound link.`] });
  updateProgress();
}

function finishTurn() {
  checked = true;
  $('checkBtn').disabled = true;
  $('nextBtn').classList.remove('hidden');
}

function renderFeedback(r) {
  const fb = $('feedback'); fb.classList.remove('hidden');
  const tone = r.score >= 90 ? 'great' : r.score >= 70 ? 'ok' : 'bad';
  $('scoreNum').textContent = r.score;
  $('scoreRing').className = `score ${tone}`;
  $('msgs').innerHTML = r.messages.map((m) => `<li>${m}</li>`).join('');
  $('chips').innerHTML = (r.strokes || []).map((s) => {
    const cls = !s.ordered ? 'chip warn' : s.reversed ? 'chip warn' : s.shape >= 0.6 ? 'chip good' : 'chip soft';
    const tag = !s.ordered ? `→#${s.drawnIndex + 1}` : s.reversed ? '↺' : `${Math.round(s.shape * 100)}%`;
    return `<span class="${cls}">stroke ${s.templateIndex + 1} ${tag}</span>`;
  }).join('');
}

// ── sensei ───────────────────────────────────────────────────────────────────
async function askSensei() {
  const card = $('senseiCard'); card.classList.remove('hidden');
  $('senseiBody').innerHTML = '<em>Sensei is thinking…</em>';
  const info = KANA[current];
  const res = await mnemonic({ char: current, reading: info.reading, type: info.type });
  let html = `<p class="mnemonic">${res.mnemonic}</p>`;
  if (res.example) {
    const e = res.example;
    html += `<p class="example"><span class="jp">${e.word}</span> <span class="rd">${e.reading}</span> — ${e.meaning}</p>`;
  }
  card.classList.toggle('offline', !!res.offline);
  $('senseiBody').innerHTML = html;
}

async function finishSession() {
  const s = srs.stats(pool());
  const card = $('senseiCard'); card.classList.remove('hidden');
  $('senseiBody').innerHTML = '<em>Sensei is reviewing your session…</em>';
  const res = await review({
    weakest: s.weakest.map((w) => ({ char: w.char, reading: KANA[w.char].reading, misses: w.seen - w.correct })),
    accuracy: s.accuracy, mastered: s.mastered, poolSize: s.poolSize,
  });
  const weak = s.weakest.length
    ? `<p class="example">Focus next: ${s.weakest.map((w) => `<span class="jp">${w.char}</span>`).join(' ')}</p>` : '';
  $('senseiBody').innerHTML = `<p class="mnemonic">${res.note}</p>${weak}`;
}

// ── chrome ───────────────────────────────────────────────────────────────────
function updateProgress() {
  const s = srs.stats(pool());
  const pct = (n) => `${(100 * n / Math.max(1, s.poolSize)).toFixed(1)}%`;
  $('barMastered').style.width = pct(s.mastered);
  $('barLearning').style.width = pct(s.learning);
  $('mastered').textContent = `${s.mastered}/${s.poolSize} mastered`;
  $('learning').textContent = `${s.learning} learning`;
  $('accuracy').textContent = s.accuracy === null ? 'new' : `${s.accuracy}% accuracy`;
}

function setDrill(d) {
  drill = d;
  document.querySelectorAll('[data-drill]').forEach((b) => b.classList.toggle('active', b.dataset.drill === d));
  const isRead = d === 'read';
  const cross = d === 'hira2kata' || d === 'kata2hira';
  $('padWrap').classList.toggle('hidden', isRead);
  $('typeWrap').classList.toggle('hidden', !isRead);
  ['undoBtn', 'clearBtn', 'hintBtn'].forEach((id) => $(id).classList.toggle('hidden', isRead));
  $('speakBtn').classList.toggle('hidden', isRead); // hide audio in read drill (it's the answer)
  $('scriptRow').classList.toggle('disabled', cross);
  nextKana();
}

function setScript(s) {
  script = s;
  document.querySelectorAll('[data-script]').forEach((b) => b.classList.toggle('active', b.dataset.script === s));
  nextKana();
}

function speak() {
  if (!('speechSynthesis' in window)) return;
  const ch = drill === 'write' ? target : current;
  const u = new SpeechSynthesisUtterance(ch);
  u.lang = 'ja-JP'; u.rate = 0.85;
  const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('ja'));
  if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

function setupControls() {
  $('undoBtn').onclick = undo;
  $('clearBtn').onclick = clearPad;
  $('hintBtn').onclick = showHint;
  $('checkBtn').onclick = check;
  $('nextBtn').onclick = nextKana;
  $('speakBtn').onclick = speak;
  $('senseiBtn').onclick = askSensei;
  $('finishBtn').onclick = finishSession;
  $('resetBtn').onclick = () => { if (confirm('Reset all progress?')) { srs.reset(); nextKana(); } };
  $('answerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') (checked ? nextKana() : check());
  });
  document.querySelectorAll('[data-drill]').forEach((b) => (b.onclick = () => setDrill(b.dataset.drill)));
  document.querySelectorAll('[data-script]').forEach((b) =>
    (b.onclick = () => { if (!$('scriptRow').classList.contains('disabled')) setScript(b.dataset.script); }));
}
