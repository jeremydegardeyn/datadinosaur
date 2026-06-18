/**
 * sensei.js — the "AI Sensei", now fully client-side and offline.
 *
 * Mnemonics are AI-authored but PRE-GENERATED into js/mnemonics.json (the set
 * of kana is finite and never changes), so there's no runtime model, no API
 * call, and nothing to rate-limit or abuse. The end-of-session review is a
 * small deterministic template built from your own stats.
 *
 * Same function signatures as before, so app.js is unchanged.
 */

let _cache = null;
async function load() {
  if (!_cache) _cache = await fetch('./js/mnemonics.json').then((r) => r.json());
  return _cache;
}

export async function mnemonic({ char }) {
  const all = await load();
  return all[char] || { mnemonic: `No mnemonic for ${char} yet — picture its shape and link it to the sound.`, example: null };
}

export async function review({ weakest, accuracy, mastered, poolSize }) {
  if (accuracy === null || accuracy === undefined) {
    return { note: 'Draw a few kana first, then come back and I’ll size up how you’re doing.' };
  }
  const opener = accuracy >= 90 ? 'Excellent work' : accuracy >= 70 ? 'Solid progress' : 'Keep at it';
  let note = `${opener} — ${accuracy}% accuracy, ${mastered}/${poolSize} kana mastered.`;
  if (weakest && weakest.length) {
    const list = weakest.slice(0, 4).map((w) => w.char).join(' ');
    note += ` Your shakiest right now: ${list}. Slow down on those and mind the classic look-alikes — シ/ツ, ソ/ン, ね/わ/れ — they trip everyone up.`;
  } else {
    note += ' No weak spots flagged yet — try switching drills or adding katakana to push yourself.';
  }
  return { note };
}
