/**
 * srs.js — a small Leitner-style spaced-repetition scheduler.
 *
 * Each kana lives in a "box" (1..5). Lower box = seen less / missed more =>
 * shown sooner and more often. State persists in localStorage so progress
 * survives reloads, and the per-kana error tallies feed the AI sensei's
 * adaptive review at the end of a session.
 */

const STORE_KEY = 'kana-sensei.srs.v1';
const BOX_DELAY = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 }; // attempts-until-due per box

export class SRS {
  constructor(allChars) {
    this.all = allChars;
    const saved = this._load();              // { clock, state } (matches _save)
    this.clock = saved.clock || 0;
    this.state = saved.state || {};
    for (const ch of allChars) {
      if (!this.state[ch]) this.state[ch] = { box: 1, due: 0, seen: 0, correct: 0, streak: 0 };
    }
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  _save() {
    const blob = { clock: this.clock, state: this.state };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(blob)); } catch { /* private mode */ }
  }
  reset() {
    this.clock = 0;
    this.state = {};
    for (const ch of this.all) this.state[ch] = { box: 1, due: 0, seen: 0, correct: 0, streak: 0 };
    try { localStorage.removeItem(STORE_KEY); } catch {}
  }

  /** Pick the next kana from `pool` (the chars allowed by the current mode). */
  next(pool) {
    const candidates = pool.filter((c) => this.state[c]);
    // 1) anything overdue, hardest (lowest box) first, with a little jitter
    const due = candidates
      .filter((c) => this.state[c].due <= this.clock)
      .sort((a, b) => this.state[a].box - this.state[b].box || Math.random() - 0.5);
    if (due.length) {
      // bias toward the front (struggling) third of the due queue
      const head = due.slice(0, Math.max(1, Math.ceil(due.length / 3)));
      return head[Math.floor(Math.random() * head.length)];
    }
    // 2) nothing due — show whatever comes up soonest
    return candidates.sort((a, b) => this.state[a].due - this.state[b].due)[0];
  }

  /** Record an attempt. `correct` is the pass/fail from the grader. */
  record(ch, correct, score) {
    const s = this.state[ch];
    this.clock++;
    s.seen++;
    if (correct) {
      s.correct++;
      s.streak++;
      s.box = Math.min(5, s.box + 1);
    } else {
      s.streak = 0;
      s.box = Math.max(1, s.box - 1);
    }
    s.lastScore = score;
    s.due = this.clock + BOX_DELAY[s.box];
    this._save();
    return s;
  }

  stats(pool) {
    const items = pool.map((c) => ({ char: c, ...this.state[c] }));
    const seen = items.filter((i) => i.seen > 0);
    const mastered = items.filter((i) => i.box >= 4).length;
    const learning = items.filter((i) => i.seen > 0 && i.box < 4).length;
    const totalCorrect = seen.reduce((n, i) => n + i.correct, 0);
    const totalSeen = seen.reduce((n, i) => n + i.seen, 0);
    // weakest = most-missed, then lowest box
    const weakest = [...seen]
      .sort((a, b) => (b.seen - b.correct) - (a.seen - a.correct) || a.box - b.box)
      .slice(0, 6)
      .filter((i) => i.seen - i.correct > 0);
    return {
      mastered,
      learning,
      poolSize: pool.length,
      accuracy: totalSeen ? Math.round((totalCorrect / totalSeen) * 100) : null,
      weakest,
    };
  }
}
