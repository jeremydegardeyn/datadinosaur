import { grade } from './grader.js';
import { SRS } from './srs.js';

const $ = (id) => document.getElementById(id);
const PAD = 18;

let KANA = {};
let srs;
let mode = 'study';    // study | practice
let drill = 'read';    // read | write | convert
let script = 'hiragana'; // hiragana | katakana | both
let current = null;    // the kana being ASKED about (SRS subject + cue glyph for read/cross)
let target = null;     // the kana to DRAW (draw drills) or whose reading to TYPE (read)
let strokes = [];
let drawing = false;
let checked = false;
let sessionAttempts = 0; // completed turns this session
let sessCorrect = 0;     // correct answers this session
let sessionLen = 20;     // questions per session; results show automatically at the end
let sessionLog = [];     // one entry per answered turn: { char, target, ok, score, typed }
let queue = null;        // when set, kana are drawn from here instead of the SRS (retry misses)
const KANA_MIN = 10;     // answers needed before a session joins the leaderboard

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
  updateBestCounter();
  setMode('study');
})();

function pool() {
  let p = Object.keys(KANA).filter((c) => script === 'both' || KANA[c].type === script);
  if (drill === 'convert') p = p.filter((c) => counterpart(c)); // only chars with a twin
  return p;
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
  if (sessionAttempts >= sessionLen) return showResults();
  current = (queue && queue.length) ? queue.shift() : srs.next(pool());
  target = (drill === 'convert') ? counterpart(current) : current;
  strokes = []; checked = false;

  const info = KANA[current];
  const cueMain = $('cueMain'), cueSub = $('cueSub'), cueLabel = $('cueLabel');

  if (drill === 'write') {
    cueLabel.textContent = `Draw the ${script === 'both' ? 'kana' : script} for`;
    cueMain.textContent = pretty(info.reading);
    cueMain.className = 'cue-romaji';
    cueSub.textContent = '';
  } else if (drill === 'read') {
    cueLabel.textContent = `Type the romaji for this ${info.type}`;
    cueMain.textContent = current;
    cueMain.className = 'cue-glyph';
    cueSub.textContent = '';
  } else { // convert — show one script, draw the other
    const from = info.type;
    const to = from === 'hiragana' ? 'katakana' : 'hiragana';
    cueLabel.textContent = `Draw the ${to} for this ${from}`;
    cueMain.textContent = current;
    cueMain.className = 'cue-glyph';
    cueSub.textContent = pretty(info.reading);
  }

  $('reveal').textContent = ''; $('reveal').classList.remove('show');
  $('answerInput').value = '';
  $('readResult').textContent = '';
  $('feedback').classList.add('hidden');
  $('checkBtn').disabled = false;
  $('nextBtn').classList.add('hidden');
  $('nextBtn').textContent = 'Next →';
  render();
  renderSession();
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
  if (report.pass) sessCorrect++;
  sessionLog.push({ char: current, target, ok: report.pass, score: report.score });
  renderSession();
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
  if (ok) sessCorrect++;
  sessionLog.push({ char: current, target, ok, score: ok ? 100 : 0, typed: raw });
  renderSession();
  $('readResult').innerHTML =
    `<span class="big">${current}</span> = <span class="rd">${pretty(KANA[target].reading)}</span>` +
    (ok ? ' ✓' : ` — you wrote “${raw}”`);
  $('readResult').className = ok ? 'read-result good' : 'read-result bad';
  renderFeedback({ score: ok ? 100 : 0, strokes: [],
    messages: [ok ? 'Correct! 🎉' : `Not quite — try to remember this shape→sound link.`] });
  updateProgress();
}

function finishTurn() {
  checked = true;
  $('checkBtn').disabled = true;
  $('nextBtn').classList.remove('hidden');
  sessionAttempts++;
  $('endEarlyBtn').classList.toggle('hidden', sessionAttempts < 2 || sessionAttempts >= sessionLen);
  if (sessionAttempts >= sessionLen) $('nextBtn').textContent = 'See results →';
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

// ── session tracker + results ─────────────────────────────────────────────────
function tileHtml(i, big) {
  const e = sessionLog[i];
  const cls = e ? (e.ok ? 'tile ok' : 'tile bad') : (i === sessionAttempts && !checked ? 'tile now' : 'tile');
  const title = e ? `${e.char} · ${e.ok ? 'correct' : 'missed'}` : `question ${i + 1}`;
  return `<span class="${cls}" title="${title}">${e && big ? e.char : ''}</span>`;
}

function renderSession() {
  $('sessPos').textContent = sessionAttempts;
  $('sessLen').textContent = sessionLen;
  $('sessOk').textContent = sessCorrect;
  $('sessBad').textContent = sessionAttempts - sessCorrect;
  let h = '';
  for (let i = 0; i < sessionLen; i++) h += tileHtml(i, false);
  $('sessTiles').innerHTML = h;
}

async function showResults() {
  const total = sessionAttempts, correct = sessCorrect;
  if (!total) return startSession();
  $('gameView').classList.add('hidden');
  $('resultsView').classList.remove('hidden');
  const pct = Math.round(100 * correct / total);
  $('resScore').textContent = `${correct} / ${total}`;
  $('resPct').textContent = `${pct}%`;
  const s = srs.stats(pool());
  $('resSub').textContent = `${s.mastered}/${s.poolSize} kana mastered overall` +
    (s.weakest.length ? ` · shakiest: ${s.weakest.slice(0, 4).map((w) => w.char).join(' ')}` : '');
  let tiles = '';
  for (let i = 0; i < total; i++) tiles += tileHtml(i, true);
  $('resTiles').innerHTML = tiles;

  const misses = sessionLog.filter((e) => !e.ok);
  $('retryMissesBtn').classList.toggle('hidden', misses.length === 0);
  if (!misses.length) {
    $('resMisses').innerHTML = '<p class="misses-none">Perfect session — nothing missed. 🎉</p>';
  } else {
    $('resMisses').innerHTML = `<h3>Missed (${misses.length})</h3>` + misses.map((e) => {
      const info = KANA[e.target];
      const yours = e.typed !== undefined
        ? `<span class="lbl">you wrote</span><span class="yours">${e.typed || '—'}</span>`
        : `<span class="lbl">your drawing</span><span class="yours">${e.score}/100</span>`;
      return `<div class="miss-row"><span class="jp">${e.target}</span>` +
        `<span><span class="lbl">reading</span><span class="rd">${pretty(info.reading)}</span></span><span>${yours}</span></div>`;
    }).join('');
  }
  $('resLb').innerHTML = await sessionLeaderboardHtml();
}

function startSession({ retry = false } = {}) {
  const misses = retry ? sessionLog.filter((e) => !e.ok).map((e) => e.char) : [];
  sessionAttempts = 0; sessCorrect = 0; sessionLog = [];
  if (retry && misses.length) {
    // Shuffle so the retry order differs from the first pass.
    for (let i = misses.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [misses[i], misses[j]] = [misses[j], misses[i]];
    }
    queue = misses; sessionLen = misses.length;
  } else {
    queue = null;
    const active = document.querySelector('[data-len].active');
    sessionLen = Number(active ? active.dataset.len : 20);
  }
  $('resultsView').classList.add('hidden');
  $('gameView').classList.remove('hidden');
  $('endEarlyBtn').classList.add('hidden');
  nextKana();
}

// ── cross-user session leaderboard (accuracy histogram, like the blog quizzes) ─
function loadBest() {
  try { return JSON.parse(localStorage.getItem('kanaBest')) || { acc: 0 }; }
  catch (e) { return { acc: 0 }; }
}
function saveBest(acc, correct, total) {
  const b = loadBest();
  if (acc > (b.acc || 0)) localStorage.setItem('kanaBest', JSON.stringify({ acc, correct, total }));
  updateBestCounter();
}
function updateBestCounter() {
  const el = $('bestSession'); if (!el) return;
  const b = loadBest();
  el.textContent = b.acc ? `best ${b.acc}%` : '';
}

async function sessionLeaderboardHtml() {
  const total = sessionAttempts, correct = sessCorrect;
  if (total < KANA_MIN) {
    return `<p class="kana-lb-note">Answer at least ${KANA_MIN} in a session to join the leaderboard — you did ${total}.</p>`;
  }
  const acc = Math.round(100 * correct / total);
  saveBest(acc, correct, total);
  let data = null;
  try {
    const r = await fetch('/api/kana', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct, total }),
    });
    data = await r.json();
  } catch (e) { /* offline or API down — show the local numbers only */ }

  const best = loadBest().acc;
  let h = `<div class="kana-lb"><p class="kana-lb-title">This session <b>${acc}%</b> (${correct}/${total}) · Best <b>${best}%</b></p>`;
  if (data && data.dist) {
    h += kanaHist(data.dist, data.count, Math.round(best / 10));
    h += `<p class="kana-lb-cap">Your best lands here among ${data.count} ${data.count === 1 ? 'session' : 'sessions'}.</p>`;
  }
  return h + `</div>`;
}

function kanaHist(dist, count, bestIdx) {
  const max = Math.max(1, ...dist);
  let bars = '';
  for (let s = 0; s <= 10; s++) {
    const c = dist[s] || 0;
    const you = s === bestIdx ? ' you' : '';
    bars += `<div class="kana-col${you}">` +
      (s === bestIdx ? `<span class="kana-you">You</span>` : '') +
      `<div class="kana-bar" style="height:${Math.round(c / max * 100)}%"></div>` +
      `<span class="kana-lbl">${s * 10}</span></div>`;
  }
  return `<div class="kana-hist">${bars}</div>`;
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

function setMode(m) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  const isStudy = m === 'study';
  $('drillRow').classList.toggle('hidden', isStudy);
  $('lenRow').classList.toggle('hidden', isStudy);
  $('gameView').classList.toggle('hidden', isStudy || sessionAttempts >= sessionLen);
  $('resultsView').classList.toggle('hidden', isStudy || sessionAttempts < sessionLen);
  $('studyView').classList.toggle('hidden', !isStudy);
  if (isStudy) { renderStudy(); updateProgress(); }
  else setDrill(drill, { keepSession: true });
}

function setDrill(d, { keepSession = false } = {}) {
  drill = d;
  document.querySelectorAll('[data-drill]').forEach((b) => b.classList.toggle('active', b.dataset.drill === d));
  const isRead = d === 'read';
  $('padWrap').classList.toggle('hidden', isRead);
  $('typeWrap').classList.toggle('hidden', !isRead);
  ['undoBtn', 'clearBtn', 'hintBtn'].forEach((id) => $(id).classList.toggle('hidden', isRead));
  $('speakBtn').classList.toggle('hidden', isRead); // hide audio in read drill (it's the answer)
  if (keepSession && sessionAttempts > 0) nextKana(); else startSession();
}

function setScript(s) {
  script = s;
  document.querySelectorAll('[data-script]').forEach((b) => b.classList.toggle('active', b.dataset.script === s));
  if (mode === 'study') renderStudy(); else startSession();
}

// ── study chart: the gojūon table, laid out by vowel (columns) and consonant
//    (rows), with the gaps left blank — then the voiced / p-sound rows below.
const GOJUON_ROWS = [
  ['a',  'i',   'u',   'e',  'o' ],
  ['ka', 'ki',  'ku',  'ke', 'ko'],
  ['sa', 'shi', 'su',  'se', 'so'],
  ['ta', 'chi', 'tsu', 'te', 'to'],
  ['na', 'ni',  'nu',  'ne', 'no'],
  ['ha', 'hi',  'fu',  'he', 'ho'],
  ['ma', 'mi',  'mu',  'me', 'mo'],
  ['ya', null,  'yu',  null, 'yo'],
  ['ra', 'ri',  'ru',  're', 'ro'],
  ['wa', null,  null,  null, 'wo'],
  ['n',  null,  null,  null, null],
];
const DAKUTEN_ROWS = [
  ['ga', 'gi',  'gu',  'ge', 'go'],
  ['za', 'ji',  'zu',  'ze', 'zo'],
  ['da', 'dji', 'dzu', 'de', 'do'],
  ['ba', 'bi',  'bu',  'be', 'bo'],
  ['pa', 'pi',  'pu',  'pe', 'po'],
];

function studyCell(ch) {
  const info = KANA[ch];
  const cell = document.createElement('button');
  cell.className = 'gcell';
  cell.title = `${pretty(info.reading)} · hover to see it drawn`;
  cell.innerHTML =
    `<span class="kcell-glyph">${ch}</span>` +
    `<canvas class="kcell-canvas" width="120" height="120" aria-hidden="true"></canvas>` +
    `<span class="gcell-romaji">${pretty(info.reading)}</span>`;
  const cv = cell.querySelector('canvas');
  let cancel = null;
  const start = () => { if (!cancel) { cell.classList.add('drawing'); cancel = animateStrokesOn(cv, ch); } };
  const stop = () => {
    if (cancel) { cancel(); cancel = null; }
    cell.classList.remove('drawing');
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  };
  cell.addEventListener('mouseenter', start);
  cell.addEventListener('mouseleave', stop);
  cell.addEventListener('focus', start);
  cell.addEventListener('blur', stop);
  return cell;
}

function buildGojuon(byReading, rows) {
  const grid = document.createElement('div');
  grid.className = 'gojuon';
  for (const row of rows) {
    for (const r of row) {
      const ch = r && byReading[r];
      if (ch) {
        grid.appendChild(studyCell(ch));
      } else {
        const e = document.createElement('div');
        e.className = 'gcell empty';
        grid.appendChild(e);
      }
    }
  }
  return grid;
}

function renderStudy() {
  const host = $('studyGrid');
  host.innerHTML = '';
  const scripts = script === 'both' ? ['hiragana', 'katakana'] : [script];
  for (const sc of scripts) {
    const byReading = {};
    Object.keys(KANA).filter((c) => KANA[c].type === sc)
      .forEach((c) => { byReading[KANA[c].reading] = c; });

    if (script === 'both') {
      const h = document.createElement('h3');
      h.className = 'kana-sec';
      h.textContent = sc === 'hiragana' ? 'Hiragana' : 'Katakana';
      host.appendChild(h);
    }

    host.appendChild(buildGojuon(byReading, GOJUON_ROWS));

    const lab = document.createElement('p');
    lab.className = 'kana-extra-label';
    lab.textContent = 'Voiced & p-sounds  (゛ dakuten · ゜ handakuten)';
    host.appendChild(lab);
    host.appendChild(buildGojuon(byReading, DAKUTEN_ROWS));
  }
}

function animateStrokesOn(cv, ch) {
  const ctx = cv.getContext('2d');
  const S = cv.width, P = 16;
  const tmpl = KANA[ch].strokes.map((s) => s.map(([x, y]) => [P + x * (S - 2 * P), P + y * (S - 2 * P)]));
  // Half speed (perStroke/gap doubled) and a long hold on the finished glyph
  // before it clears and redraws.
  const perStroke = 840, gap = 240, endHold = 1400;
  const total = tmpl.length * (perStroke + gap) + endHold;
  const begin = performance.now();
  let raf;
  const frame = (now) => {
    const t = (now - begin) % total;
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = '#6fb3ff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let acc = 0;
    for (let i = 0; i < tmpl.length; i++) {
      const s = acc, e = acc + perStroke;
      let frac;
      if (t >= e + gap) frac = 1; else if (t >= s) frac = Math.min(1, (t - s) / perStroke); else break;
      const st = tmpl[i], n = Math.max(2, Math.floor(st.length * frac));
      ctx.beginPath(); ctx.moveTo(st[0][0], st[0][1]);
      for (let j = 1; j < n; j++) ctx.lineTo(st[j][0], st[j][1]);
      ctx.stroke();
      acc = e + gap;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
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
  $('newSessionBtn').onclick = () => startSession();
  $('retryMissesBtn').onclick = () => startSession({ retry: true });
  $('endEarlyBtn').onclick = () => { sessionLen = sessionAttempts; showResults(); };
  document.querySelectorAll('[data-len]').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('[data-len]').forEach((x) => x.classList.toggle('active', x === b));
    startSession();
  }));
  $('resetBtn').onclick = () => { if (confirm('Reset all progress?')) { srs.reset(); nextKana(); } };
  $('answerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') (checked ? nextKana() : check());
  });
  document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  document.querySelectorAll('[data-drill]').forEach((b) => (b.onclick = () => setDrill(b.dataset.drill)));
  document.querySelectorAll('[data-script]').forEach((b) => (b.onclick = () => setScript(b.dataset.script)));
}
