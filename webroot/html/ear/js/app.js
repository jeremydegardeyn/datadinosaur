/**
 * app.js — Fretboard Ear: game state and UI wiring.
 * Everything runs client-side: synthesis (audio.js), theory (theory.js),
 * and the SVG fretboard (fretboard.js). Nothing is sent anywhere.
 */
import { KEY_LIST, buildKey, spell, pc, positionsForPc, voicingsFor, voicingMidi,
         pickRandom, OPEN_STRINGS } from './theory.js';
import { audioContext, playNote, playChord, playReference } from './audio.js';
import { createFretboard } from './fretboard.js';

const $ = (id) => document.getElementById(id);
const LS_KEY = 'ear.v1';

const state = {
  mode: 'note',            // 'note' | 'chord'
  key: buildKey('C'),
  refFirst: true,          // play the tonic chord before each question
  question: null,          // { index, played } | { index, voicing }
  answered: false,
  lastPc: null,            // avoid the same answer twice in a row
  stats: { correct: 0, total: 0, streak: 0 },
  best: loadBest(),
};

function loadBest() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}').best || 0; } catch { return 0; }
}
function saveBest() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ best: state.best })); } catch { /* private mode */ }
}

/* ---------- fretboard ---------- */
const board = createFretboard($('fretboard'), {
  onPluck: ({ string, fret, midi }) => {
    audioContext();
    playNote(midi, { gain: 0.45 });
    board.flash(string, fret, spell(pc(midi), state.key));
  },
});

/* ---------- controls ---------- */
const keySel = $('keySel');
for (const k of KEY_LIST) {
  const o = document.createElement('option');
  o.value = k.id; o.textContent = k.label;
  keySel.appendChild(o);
}
keySel.value = state.key.id;
keySel.addEventListener('change', () => { state.key = buildKey(keySel.value); resetRound(); });

document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('active', x === b));
  state.mode = b.dataset.mode;
  resetRound();
}));

$('refToggle').addEventListener('change', (e) => { state.refFirst = e.target.checked; });
$('refBtn').addEventListener('click', () => { audioContext(); playRef(); });
$('playBtn').addEventListener('click', onPlay);
$('nextBtn').addEventListener('click', nextQuestion);
$('resetBtn').addEventListener('click', () => {
  state.stats = { correct: 0, total: 0, streak: 0 };
  renderStats();
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT') return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); state.answered ? nextQuestion() : onPlay(); return; }
  if (e.key === 'r' || e.key === 'R') { playRef(); return; }
  const n = parseInt(e.key, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 9 && state.question && !state.answered) {
    const btn = $('answers').children[n - 1];
    if (btn) btn.click();
  }
});

/* ---------- reference (tonic) ---------- */
function tonicVoicing() {
  const k = state.key;
  const v = voicingsFor(k.tonic, k.minor ? 'min' : 'maj');
  return v[0] || null;
}
function playRef() {
  const v = tonicVoicing();
  if (v) playReference(voicingMidi(v));
}

/* ---------- answers grid ---------- */
function renderAnswers() {
  const wrap = $('answers');
  wrap.innerHTML = '';
  const k = state.key;
  const items = state.mode === 'note' ? k.degrees : k.chords;
  wrap.classList.toggle('dense', items.length > 8);
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'ans';
    b.dataset.i = i;
    const main = document.createElement('span');
    main.className = 'ans-main';
    main.textContent = it.name;
    b.appendChild(main);
    const sub = document.createElement('span');
    sub.className = 'ans-sub';
    sub.textContent = state.mode === 'note' ? (it.degree ? `deg ${it.degree}` : '') : it.roman;
    b.appendChild(sub);
    b.addEventListener('click', () => answer(i));
    wrap.appendChild(b);
  });
  setAnswersEnabled(false);
}
function setAnswersEnabled(on) {
  document.querySelectorAll('#answers .ans').forEach(b => { b.disabled = !on; });
}

/* ---------- round lifecycle ---------- */
function resetRound() {
  state.question = null;
  state.answered = false;
  state.lastPc = null;
  board.clear();
  renderAnswers();
  $('refRow').classList.toggle('hidden', state.key.chromatic);
  $('keyName').textContent = state.key.label;
  $('prompt').textContent = state.mode === 'note'
    ? 'Press Play, then pick the note you hear.'
    : 'Press Play, then pick the chord you hear.';
  $('result').textContent = '';
  $('result').className = 'result';
  $('nextBtn').classList.add('hidden');
  $('playBtn').textContent = '▶ Play';
}

function makeQuestion() {
  const k = state.key;
  if (state.mode === 'note') {
    let idx, tries = 0;
    do { idx = Math.floor(Math.random() * k.degrees.length); }
    while (k.degrees[idx].pc === state.lastPc && ++tries < 8);
    const target = k.degrees[idx];
    const pos = pickRandom(positionsForPc(target.pc));
    state.lastPc = target.pc;
    return { index: idx, played: { ...pos, midi: OPEN_STRINGS[pos.string] + pos.fret } };
  }
  let idx, tries = 0;
  do { idx = Math.floor(Math.random() * k.chords.length); }
  while (k.chords[idx].root === state.lastPc && ++tries < 8);
  const chord = k.chords[idx];
  const voicing = pickRandom(voicingsFor(chord.root, chord.quality));
  state.lastPc = chord.root;
  return { index: idx, voicing };
}

function playQuestion() {
  const q = state.question;
  const ac = audioContext();
  let delay = 0;
  if (state.refFirst && !state.key.chromatic && !state.answered) {
    playRef();
    delay = 1.35;
  }
  const when = ac.currentTime + delay + 0.02;
  if (state.mode === 'note') {
    playNote(q.played.midi, { when, gain: 0.5 });
  } else {
    const midis = voicingMidi(q.voicing);
    midis.forEach((m, i) => playNote(m, { when: when + i * 0.045, gain: 0.32 }));
  }
}

function onPlay() {
  audioContext();
  if (!state.question) {
    state.question = makeQuestion();
    $('playBtn').textContent = '↻ Replay';
    $('prompt').textContent = state.mode === 'note' ? 'Which note is this?' : 'Which chord is this?';
    setAnswersEnabled(true);
  }
  playQuestion();
}

function nextQuestion() {
  state.question = null;
  state.answered = false;
  board.clear();
  $('result').textContent = '';
  $('result').className = 'result';
  $('nextBtn').classList.add('hidden');
  document.querySelectorAll('#answers .ans').forEach(b => b.classList.remove('correct', 'wrong'));
  onPlay();
}

function answer(i) {
  if (!state.question || state.answered) return;
  state.answered = true;
  const k = state.key;
  const q = state.question;
  const correct = i === q.index;
  const btns = $('answers').children;
  btns[q.index].classList.add('correct');
  if (!correct) btns[i].classList.add('wrong');
  setAnswersEnabled(false);

  // Stats
  state.stats.total++;
  if (correct) { state.stats.correct++; state.stats.streak++; }
  else state.stats.streak = 0;
  if (state.stats.streak > state.best) { state.best = state.stats.streak; saveBest(); }
  renderStats();

  // Reveal on the fretboard
  const label = (p) => spell(p, k);
  if (state.mode === 'note') {
    const target = k.degrees[q.index];
    board.showNote(q.played, positionsForPc(target.pc), label(target.pc));
    const where = `string ${6 - q.played.string} (${['E','A','D','G','B','e'][q.played.string]}), fret ${q.played.fret}`;
    const yours = k.degrees[i].name;
    $('result').innerHTML = correct
      ? `✅ <b>${target.name}</b> — played on ${where}.`
      : `❌ You picked <b>${yours}</b>. It was <b>${target.name}</b> — played on ${where}.`;
  } else {
    const chord = k.chords[q.index];
    board.showChord(q.voicing, chord.root, label);
    const yours = k.chords[i].name;
    const shape = q.voicing.map(f => (f < 0 ? 'x' : f)).join('-');
    $('result').innerHTML = correct
      ? `✅ <b>${chord.name}</b>${chord.roman ? ` (${chord.roman})` : ''} — shape ${shape}.`
      : `❌ You picked <b>${yours}</b>. It was <b>${chord.name}</b>${chord.roman ? ` (${chord.roman})` : ''} — shape ${shape}.`;
  }
  $('result').className = 'result ' + (correct ? 'ok' : 'bad');
  $('nextBtn').classList.remove('hidden');
  $('nextBtn').focus();
}

function renderStats() {
  const s = state.stats;
  $('score').textContent = `${s.correct} / ${s.total}`;
  $('acc').textContent = s.total ? `${Math.round((100 * s.correct) / s.total)}%` : '—';
  $('streak').textContent = `${s.streak} streak`;
  $('best').textContent = state.best ? `best ${state.best}` : '';
}

/* ---------- boot ---------- */
$('refToggle').checked = state.refFirst;
renderStats();
resetRound();
