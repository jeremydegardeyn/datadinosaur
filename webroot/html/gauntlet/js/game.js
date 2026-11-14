/* Guardrail Gauntlet — you are the AI gateway.
   Static, browser-only: no model calls, no server. Deck in deck.js. */
(function () {
  'use strict';

  var D = window.GG_DECK;
  var $ = function (id) { return document.getElementById(id); };
  var SITE = 'https://www.datadinosaur.com';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WAVES = 8;
  // Speed is a percentage of the original 'Standard' pace. 60 is the default,
  // 25 the slowest. Travel time and the gaps between requests scale by 100/speed;
  // slower speeds also send fewer requests per wave so a shift doesn't drag.
  var SPEED_MIN = 25, SPEED_MAX = 150, SPEED_DEFAULT = 60;
  var speed = SPEED_DEFAULT;
  function K() { return 100 / speed; }
  function countScale() { return Math.min(1, Math.sqrt(speed / 100)); }
  function baseTravel(n) { return Math.max(5.5, 10 - n * 0.55); }
  var CACHE_DELAY = 2.5;           // seconds before a registry disable takes effect

  // ---------------------------------------------------------------- utils
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // ---------------------------------------------------------------- deck draws
  var pools = {};
  function draw(cat) {
    if (!pools[cat] || !pools[cat].length) pools[cat] = shuffle(D.ITEMS[cat].slice());
    return pools[cat].pop();
  }
  var chainPool = [];
  function drawChain() {
    if (!chainPool.length) chainPool = shuffle(D.CHAINS.map(function (_, i) { return i; }));
    return D.CHAINS[chainPool.pop()];
  }
  var nextId = 1;
  function makeReq(cat, raw, agent, extra) {
    var C = D.CATEGORIES[cat];
    var isTool = raw.indexOf('T:') === 0;
    var r = {
      id: nextId++, cat: cat, text: isTool ? raw.slice(2) : raw, isTool: isTool,
      agent: agent, action: C.action, cost: C.cost[1] ? randi(C.cost[0], C.cost[1]) : 0,
      explain: C.explain, post: C.post, label: C.label
    };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }

  // ---------------------------------------------------------------- audio
  var Snd = {
    ctx: null, master: null, muted: store('gg-muted') === '1',
    init: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    },
    setMuted: function (m) {
      this.muted = m; store('gg-muted', m ? '1' : '0');
      document.body.classList.toggle('muted', m);
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
    tone: function (f, dur, type, vol, slide, delay) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime + (delay || 0);
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    },
    noise: function (dur, vol, freq, delay) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime + (delay || 0);
      var n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 0.8;
      g.gain.value = vol || 0.2;
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
    },
    allow:   function () { this.tone(880, 0.09, 'triangle', 0.12); this.tone(1320, 0.08, 'triangle', 0.08, null, 0.05); },
    block:   function () { this.noise(0.12, 0.35, 300); this.tone(140, 0.14, 'square', 0.12, 70); },
    redact:  function () { this.tone(500, 0.18, 'sawtooth', 0.08, 1400); this.noise(0.15, 0.08, 3000); },
    disable: function () { this.tone(660, 0.25, 'square', 0.1, 110); },
    breach:  function () { this.tone(110, 0.45, 'sawtooth', 0.22, 55); this.noise(0.35, 0.3, 800); },
    wrong:   function () { this.tone(220, 0.2, 'triangle', 0.14, 160); },
    alert:   function () { for (var i = 0; i < 3; i++) this.tone(988, 0.12, 'square', 0.09, null, i * 0.18); },
    cleared: function () { [523, 659, 784, 1047].forEach(function (f, i) { Snd.tone(f, 0.18, 'triangle', 0.12, null, i * 0.09); }); },
    beat: function (step, intensity) {
      var bass = [55, 55, 65.41, 49][Math.floor(step / 4) % 4];
      if (step % 2 === 0) this.tone(bass * (step % 4 === 0 ? 1 : 2), 0.16, 'sine', 0.16 + intensity * 0.08);
      if (intensity > 0.35 && step % 2 === 1) this.noise(0.03, 0.06 + intensity * 0.06, 7000);
      if (intensity > 0.7 && step % 4 === 3) this.tone(bass * 4, 0.08, 'square', 0.04);
    }
  };

  // ---------------------------------------------------------------- canvas & layout
  var canvas = $('field'), ctx = canvas.getContext('2d');
  var W = 800, H = 400, DPR = 1;
  var L = {};                          // layout
  var dino = new Image(); dino.src = '/assets/images/favicon-180.png';

  function layout() {
    var r = canvas.parentElement.getBoundingClientRect();
    var oldW = W, oldH = H;
    W = Math.max(320, r.width); H = Math.max(240, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var narrow = W < 560;
    L.agentX = narrow ? 34 : 58;
    L.gateX = W * (narrow ? 0.7 : 0.68);
    L.modelX = W - (narrow ? 30 : 56); L.modelY = H * 0.3;
    L.toolsX = W - (narrow ? 30 : 56); L.toolsY = H * 0.72;
    L.agentY = {};
    var aws = D.AGENTS.filter(function (a) { return a.cloud === 'aws'; });
    var gcp = D.AGENTS.filter(function (a) { return a.cloud === 'gcp'; });
    aws.forEach(function (a, i) { L.agentY[a.id] = H * (0.13 + i * 0.13); });
    gcp.forEach(function (a, i) { L.agentY[a.id] = H * (0.6 + i * 0.13); });
    if (G && G.packets && oldW) {
      G.packets.forEach(function (p) { p.x *= W / oldW; p.y *= H / oldH; p.sy *= H / oldH; });
    }
    applySpeed();
  }
  // Packet velocity in px/s for the current wave, from the speed setting.
  function applySpeed() {
    if (!G || !G.cfg) return;
    G.cfg.travel = G.cfg.travelBase * K();
    G.speed = (L.gateX - L.agentX) / G.cfg.travel;
  }

  // ---------------------------------------------------------------- state
  var G = null;
  function newGame() {
    G = {
      wave: 0, score: 0, combo: 0, trust: 100, budget: 100, budgetMax: 100,
      time: 0, running: false, paused: false, over: false,
      packets: [], particles: [], floats: [], schedule: [], waveT: 0,
      mistakes: [], waveStats: null,
      totals: { handled: 0, correct: 0, breaches: 0, falseBlocks: 0, tokens: 0, latencySum: 0, latencyN: 0, contained: 0 },
      agents: {}, target: null, manualTarget: null, shake: 0, chomp: 0, beatAcc: 0, beatStep: 0,
      bannerUntil: 0
    };
    D.AGENTS.forEach(function (a) { G.agents[a.id] = { id: a.id, cloud: a.cloud, state: 'active', revokeAt: 0, wasCompromised: false }; });
    renderRegistry();
  }

  function waveCfg(n) {
    var mix = { benign: 5, pii: 2 };
    if (n >= 2) mix.inject = 2;
    if (n >= 3) { mix.exfil = 1.2; mix.tool = 1.2; }
    if (n >= 5) mix.budget = 0.8;
    if (n >= 6) { mix.inject = 2.4; mix.pii = 2.4; mix.benign = 4.5; }
    return {
      count: Math.max(4, Math.round((6 + n * 2) * countScale())),
      interval: Math.max(1.3, 3.2 - n * 0.25) * K(),
      travelBase: baseTravel(n),
      travel: baseTravel(n) * K(),
      chains: n >= 4 ? (n >= 7 ? 3 : n >= 6 ? 2 : 1) : 0,
      rogue: n >= 3,
      mix: mix
    };
  }
  function pickCat(mix) {
    var tot = 0, k; for (k in mix) tot += mix[k];
    var r = Math.random() * tot;
    for (k in mix) { r -= mix[k]; if (r <= 0) return k; }
    return 'benign';
  }

  function startWave(n) {
    G.wave = n; G.waveT = 0; G.schedule = []; G.mistakes = [];
    G.waveStats = { handled: 0, correct: 0, breaches: 0, falseBlocks: 0, tokens: 0 };
    var cfg = G.cfg = waveCfg(n);
    G.budgetMax = 60 + cfg.count * 4.5; G.budget = G.budgetMax;
    for (var id in G.agents) { var a = G.agents[id]; a.state = 'active'; a.wasCompromised = false; }
    renderRegistry();

    var t = 1.2;
    for (var i = 0; i < cfg.count; i++) {
      var cat = pickCat(cfg.mix);
      G.schedule.push({ t: t, kind: 'single', cat: cat });
      t += cfg.interval * rand(0.7, 1.3);
    }
    var dur = t;
    for (var c = 0; c < cfg.chains; c++) {
      var t0 = rand(dur * 0.15, dur * 0.7), chain = drawChain(), cid = 'c' + nextId++;
      var gap = Math.max(1.8 * K(), cfg.interval * 1.5);
      for (var turn = 0; turn < 3; turn++) G.schedule.push({ t: t0 + turn * gap, kind: 'chain', chain: chain, cid: cid, turn: turn + 1 });
    }
    if (cfg.rogue) {
      var tr = dur * rand(0.3, 0.5);
      G.schedule.push({ t: tr, kind: 'rogueAlert' });
      for (var k = 0; k < 4; k++) G.schedule.push({ t: tr + 1.4 + k * Math.max(1.3 * K(), cfg.interval * 1.1), kind: 'rogue' });
    }
    G.schedule.sort(function (a, b) { return a.t - b.t; });
    applySpeed();
    showBanner('Wave ' + n + (n === 4 ? ': watch for conversations that turn on the third message' :
               n === 3 ? ': the registry may flag a compromised agent' :
               n === 5 ? ': runaway-cost requests join the mix' : ''), 'info', 2.6);
    G.running = true;
    updateHud(true);
  }

  // ---------------------------------------------------------------- spawning
  function liveAgents(cloud) {
    return D.AGENTS.filter(function (a) {
      var s = G.agents[a.id].state;
      return (s === 'active' || s === 'revoking' && !G.agents[a.id].wasCompromised) && (!cloud || a.cloud === cloud);
    });
  }
  function spawn(ev) {
    var req, agent;
    if (ev.kind === 'single') {
      var pool = liveAgents(); if (!pool.length) pool = D.AGENTS;
      agent = pick(pool).id;
      req = makeReq(ev.cat, draw(ev.cat), agent);
    } else if (ev.kind === 'chain') {
      if (!G.chainAgents) G.chainAgents = {};
      if (!G.chainAgents[ev.cid]) { var lp = liveAgents(); G.chainAgents[ev.cid] = pick(lp.length ? lp : D.AGENTS).id; }
      agent = G.chainAgents[ev.cid];
      var trail = ev.chain.slice(0, ev.turn - 1);
      if (ev.turn < 3) {
        req = makeReq('benign', ev.chain[ev.turn - 1], agent, {
          chainId: ev.cid, turn: ev.turn, trail: trail,
          explain: 'On its own this turn is fine, and the conversation had not turned yet. Blocking here is a false block.',
          post: D.POST.multi
        });
      } else {
        req = makeReq('chain', ev.chain[2], agent, { chainId: ev.cid, turn: 3, trail: trail });
      }
    } else if (ev.kind === 'rogueAlert') {
      var cands = liveAgents().filter(function (a) { return G.agents[a.id].state === 'active'; });
      if (!cands.length) return;
      var ra = pick(cands);
      G.rogue = ra.id;
      G.agents[ra.id].state = 'compromised';
      G.agents[ra.id].wasCompromised = true;
      showBanner('Registry alert — ' + pick(D.ROGUE_ALERTS).replace('{a}', ra.id) + ' Contain it.', 'alert', 999);
      Snd.alert();
      renderRegistry();
      return;
    } else if (ev.kind === 'rogue') {
      if (!G.rogue) return;
      var st = G.agents[G.rogue].state;
      if (st === 'disabled') return;          // contained: it stops sending through us
      agent = G.rogue;
      var src = Math.random() < 0.5 ? 'benign' : 'tool';
      req = makeReq('rogue', draw(src), agent);
    }
    if (!req) return;
    var y = L.agentY[agent] + rand(-6, 6);
    G.packets.push({
      req: req, x: L.agentX + 10, y: y, sy: y, state: 'incoming', decided: null,
      born: G.time, trail: [], pulse: Math.random() * 6
    });
  }

  // ---------------------------------------------------------------- decisions
  function agentState(id) { return G.agents[id] ? G.agents[id].state : 'active'; }

  function decide(p, act, auto) {
    if (!p || p.decided || p.state !== 'incoming') return;
    p.decided = act;
    var latency = G.time - p.born;
    var C = p.req, compromised = G.agents[C.agent] && G.agents[C.agent].wasCompromised && C.cat === 'rogue';
    var outcome;
    if (act === 'disable' && !(G.agents[C.agent] && G.agents[C.agent].wasCompromised)) outcome = 'falseDisable';
    else if (act === C.action) outcome = 'correct';
    else if (C.action === 'allow') outcome = 'false';
    else if (act === 'allow') outcome = 'breach';
    else if (C.action === 'redact' && act === 'block') outcome = 'over';
    else if (C.action === 'disable' && act === 'block') outcome = 'partial';
    else if (C.action === 'block' && act === 'disable') outcome = 'correct';
    else outcome = 'breach';                        // e.g. redacting an injection doesn't stop it

    var t = G.totals, w = G.waveStats;
    t.handled++; w.handled++;
    t.latencySum += latency; t.latencyN++;
    var progress = clamp((L.gateX - p.x) / (L.gateX - L.agentX), 0, 1);
    var mult = 1 + Math.min(G.combo, 20) * 0.1;

    if (outcome === 'correct') {
      var pts = Math.round((100 + 60 * progress) * mult);
      // Containment bonus only for the decision that actually starts the
      // disable; requests stopped while the cache refreshes score normally.
      if (act === 'disable' && agentState(C.agent) === 'compromised') { pts += 300; t.contained++; }
      G.score += pts; G.combo++; t.correct++; w.correct++;
      G.trust = Math.min(100, G.trust + 1.5);
      floatText(p.x, p.y - 16, '+' + pts, act === 'disable' ? '#a78bfa' : '#10b981');
    } else if (outcome === 'breach') {
      G.trust -= C.cat === 'chain' ? 20 : 18; G.combo = 0; t.breaches++; w.breaches++;
      shake(14); Snd.breach();
      floatText(p.x, p.y - 16, 'BREACH', '#ef4444');
      record(outcome, p, act, auto);
    } else if (outcome === 'false') {
      G.trust -= 6; G.combo = 0; t.falseBlocks++; w.falseBlocks++;
      Snd.wrong(); floatText(p.x, p.y - 16, 'false block', '#f59e0b');
      record(outcome, p, act, auto);
    } else if (outcome === 'falseDisable') {
      G.trust -= 10; G.combo = 0; t.falseBlocks++; w.falseBlocks++;
      Snd.wrong(); floatText(p.x, p.y - 16, 'healthy agent disabled', '#f59e0b');
      record(outcome, p, act, auto);
    } else if (outcome === 'over') {
      G.trust -= 2; G.score += 25;
      floatText(p.x, p.y - 16, 'over-blocked', '#f59e0b');
      record(outcome, p, act, auto);
    } else if (outcome === 'partial') {
      G.score += 40; floatText(p.x, p.y - 16, 'stopped one — agent still live', '#a78bfa');
      record(outcome, p, act, auto);
    }

    // Tokens: anything that reaches the model or tool spends budget.
    if (act === 'allow' || act === 'redact') {
      G.budget -= C.cost; t.tokens += C.cost; w.tokens += C.cost;
    }

    // Visuals + sound for the action itself.
    if (act === 'allow') { if (outcome !== 'breach' || auto) Snd.allow(); }
    else if (act === 'redact') { if (outcome !== 'breach') Snd.redact(); p.redacted = true; burst(p.x, p.y, '#f59e0b', 10); }
    else if (act === 'block') { if (outcome !== 'false') Snd.block(); explode(p, '#ef4444'); }
    else if (act === 'disable') { Snd.disable(); explode(p, '#a78bfa'); disableAgent(C.agent); }

    if (G.manualTarget === p) G.manualTarget = null;
    if (G.trust <= 0) return endShift('trust');
    if (G.budget <= 0) return endShift('budget');
    updateHud();
  }

  function record(outcome, p, act, auto) {
    G.mistakes.push({ outcome: outcome, req: p.req, act: act, auto: !!auto });
  }

  function disableAgent(id) {
    var a = G.agents[id]; if (!a) return;
    if (a.state === 'disabled' || a.state === 'revoking') return;
    a.state = 'revoking'; a.revokeAt = G.time + CACHE_DELAY;
    renderRegistry();
  }

  // ---------------------------------------------------------------- effects
  function shake(n) { if (!REDUCED) G.shake = Math.max(G.shake, n); }
  function burst(x, y, color, n) {
    n = REDUCED ? Math.ceil(n / 3) : n;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = rand(40, 180);
      G.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.8), max: 0.8, color: color, size: rand(1.5, 3.5) });
    }
  }
  function explode(p, color) {
    p.state = 'dead';
    burst(p.x, p.y, color, 22);
    // Bits fly into the dinosaur at the top of the gate.
    var n = REDUCED ? 3 : 9;
    for (var i = 0; i < n; i++) {
      G.particles.push({ x: p.x, y: p.y, vx: rand(-60, 60), vy: rand(-60, 60), life: 0.9, max: 0.9, color: color, size: 2.5, home: true });
    }
    G.chomp = 1;
  }
  function floatText(x, y, text, color) { G.floats.push({ x: x, y: y, text: text, color: color, life: 1.1 }); }

  // ---------------------------------------------------------------- update
  function update(dt) {
    G.time += dt; G.waveT += dt;

    // scheduled spawns
    while (G.schedule.length && G.schedule[0].t <= G.waveT) spawn(G.schedule.shift());

    // registry cache refresh
    var regDirty = false;
    for (var id in G.agents) {
      var a = G.agents[id];
      if (a.state === 'revoking' && G.time >= a.revokeAt) { a.state = 'disabled'; regDirty = true;
        if (a.wasCompromised) { showBanner(a.id + ' disabled. The registry now refuses its traffic at the gateway.', 'info', 3); }
      }
    }
    if (regDirty) renderRegistry();
    if (G.bannerUntil && G.time > G.bannerUntil) hideBanner();

    // packets
    var v = G.speed;
    // Once you've decided a request it no longer needs reading time: it shoots
    // to the gate and on to its target in about a second, whatever the speed setting.
    var fastV = Math.max(v, (L.gateX - L.agentX) / 0.9);
    for (var i = 0; i < G.packets.length; i++) {
      var p = G.packets[i];
      if (p.state === 'dead') continue;
      p.trail.push(p.x, p.y); if (p.trail.length > 24) p.trail.splice(0, 2);
      if (p.state === 'incoming') {
        p.x += (p.decided ? fastV : v) * dt;
        if (p.x >= L.gateX) {
          p.x = L.gateX;
          var st = agentState(p.req.agent);
          if (!p.decided && st === 'disabled') {
            // Refused by the registry: no decision needed.
            explode(p, '#64748b');
            if (p.req.cat === 'rogue') { G.score += 50; floatText(p.x, p.y - 14, 'refused by registry', '#a78bfa'); }
            continue;
          }
          if (!p.decided) decide(p, 'allow', true);
          if (!G.running) return;
          if (p.state !== 'dead') {
            p.state = 'passing';
            p.tx = p.req.isTool ? L.toolsX : L.modelX;
            p.ty = p.req.isTool ? L.toolsY : L.modelY;
          }
        }
      } else if (p.state === 'passing') {
        var dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = fastV * 1.4 * dt;
        if (d <= step) { p.state = 'dead'; burst(p.tx, p.ty, p.redacted ? '#f59e0b' : '#10b981', 6); }
        else { p.x += dx / d * step; p.y += dy / d * step; }
      }
    }
    G.packets = G.packets.filter(function (p) { return p.state !== 'dead' || false; });

    // particles
    var gx = L.gateX, gy = 26;
    G.particles.forEach(function (q) {
      if (q.home) { var hx = gx - q.x, hy = gy - q.y; q.vx += hx * 6 * dt; q.vy += hy * 6 * dt; q.vx *= 0.92; q.vy *= 0.92; }
      else q.vy += 60 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    });
    G.particles = G.particles.filter(function (q) { return q.life > 0; });
    G.floats.forEach(function (f) { f.y -= 26 * dt; f.life -= dt; });
    G.floats = G.floats.filter(function (f) { return f.life > 0; });
    G.shake = Math.max(0, G.shake - 40 * dt);
    G.chomp = Math.max(0, G.chomp - 4 * dt);

    // target
    if (G.manualTarget && (G.manualTarget.state !== 'incoming' || G.manualTarget.decided)) G.manualTarget = null;
    var t = G.manualTarget || autoTarget();
    if (t !== G.target) { G.target = t; renderInspector(); }

    // music
    var live = G.packets.filter(function (p) { return p.state === 'incoming' && !p.decided; }).length;
    var intensity = clamp(live / 7 + (G.wave - 1) / 14, 0, 1);
    var bpm = 92 + G.wave * 5 + intensity * 26;
    G.beatAcc += dt;
    var stepLen = 60 / bpm / 2;
    while (G.beatAcc >= stepLen) { G.beatAcc -= stepLen; Snd.beat(G.beatStep++, intensity); }

    // wave end
    if (!G.schedule.length && !G.packets.length) waveDone();
  }

  function autoTarget() {
    var best = null;
    for (var i = 0; i < G.packets.length; i++) {
      var p = G.packets[i];
      if (p.state !== 'incoming' || p.decided || agentState(p.req.agent) === 'disabled') continue;
      if (!best || p.x > best.x) best = p;
    }
    return best;
  }
  function targetable() {
    return G.packets.filter(function (p) { return p.state === 'incoming' && !p.decided && agentState(p.req.agent) !== 'disabled'; })
      .sort(function (a, b) { return b.x - a.x; });
  }

  // ---------------------------------------------------------------- render
  var CLOUD = { aws: '#f59e0b', gcp: '#60a5fa' };
  function render() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (G && G.shake) ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);

    // grid
    ctx.strokeStyle = 'rgba(42,48,71,.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x < W; x += 32) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (var y = 0; y < H; y += 32) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();

    // cloud zones
    zone('AWS', CLOUD.aws, H * 0.05, H * 0.42);
    zone('GOOGLE CLOUD', CLOUD.gcp, H * 0.52, H * 0.42);

    // agent nodes
    ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
    D.AGENTS.forEach(function (a) {
      var ay = L.agentY[a.id], st = G ? G.agents[a.id].state : 'active';
      var col = st === 'compromised' ? '#ef4444' : st === 'disabled' ? '#475569' : st === 'revoking' ? '#f59e0b' : CLOUD[a.cloud];
      ctx.fillStyle = col; ctx.globalAlpha = st === 'disabled' ? 0.5 : 1;
      ctx.beginPath(); ctx.arc(L.agentX, ay, 6, 0, Math.PI * 2); ctx.fill();
      if (st === 'compromised') { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(L.agentX, ay, 10 + Math.sin((G.time || 0) * 8) * 2, 0, Math.PI * 2); ctx.stroke(); }
      if (W >= 560) { ctx.fillStyle = '#8b95a8'; ctx.textAlign = 'left'; ctx.fillText(a.id, L.agentX + 12, ay - 11); }
      ctx.globalAlpha = 1;
    });

    // destinations
    core(L.modelX, L.modelY, 'MODEL', '#10b981', true);
    core(L.toolsX, L.toolsY, 'MCP TOOLS', '#a78bfa', false);

    // gate
    var gx = L.gateX;
    var grd = ctx.createLinearGradient(gx - 18, 0, gx + 18, 0);
    grd.addColorStop(0, 'rgba(16,185,129,0)'); grd.addColorStop(0.5, 'rgba(16,185,129,.22)'); grd.addColorStop(1, 'rgba(16,185,129,0)');
    ctx.fillStyle = grd; ctx.fillRect(gx - 18, 0, 36, H);
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -((G && G.time) || 0) * 30;
    ctx.beginPath(); ctx.moveTo(gx, 48); ctx.lineTo(gx, H - 8); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#10b981'; ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('GATEWAY', gx, H - 14);
    // dinosaur on the gate
    if (dino.complete && dino.naturalWidth) {
      var s = 36 * (1 + (G ? G.chomp : 0) * 0.35);
      ctx.save(); ctx.translate(gx, 24); ctx.rotate((G ? G.chomp : 0) * -0.25);
      ctx.drawImage(dino, -s / 2, -s / 2, s, s); ctx.restore();
    }

    if (!G) { ctx.restore(); return; }

    // packets
    G.packets.forEach(function (p) { drawPacket(p); });

    // particles
    G.particles.forEach(function (q) {
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    });
    ctx.globalAlpha = 1;

    // floating text
    ctx.font = '700 12px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    G.floats.forEach(function (f) { ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function zone(label, color, y, h) {
    ctx.fillStyle = color; ctx.globalAlpha = 0.05;
    ctx.fillRect(0, y, L.agentX + 70, h); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(label, 8, y + 4); ctx.textBaseline = 'middle';
  }
  function core(x, y, label, color, round) {
    var t = (G && G.time) || 0, r = 20 + Math.sin(t * 3) * 1.5;
    ctx.fillStyle = color; ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.arc(x, y, r + 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    if (round) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
    else { roundRect(x - r, y - r, r * 2, r * 2, 6); ctx.stroke(); }
    ctx.fillStyle = color; ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, x - (W < 560 ? 0 : 0), y + r + 14);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawPacket(p) {
    var cloud = G.agents[p.req.agent] ? G.agents[p.req.agent].cloud : 'aws';
    var base = CLOUD[cloud];
    var col = p.decided === 'allow' ? '#10b981' : p.decided === 'redact' ? '#f59e0b' : base;
    if (agentState(p.req.agent) === 'disabled' && !p.decided) col = '#475569';
    if (p.req.cat === 'rogue' && agentState(p.req.agent) === 'compromised') col = '#ef4444';
    // trail
    if (!REDUCED && p.trail.length > 4) {
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (var i = 2; i < p.trail.length; i += 2) {
        ctx.globalAlpha = (i / p.trail.length) * 0.35;
        ctx.beginPath(); ctx.moveTo(p.trail[i - 2], p.trail[i - 1]); ctx.lineTo(p.trail[i], p.trail[i + 1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    var isT = p === G.target;
    if (isT) {
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 15 + Math.sin(G.time * 10) * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = col;
    if (p.req.isTool) { roundRect(p.x - 8, p.y - 8, 16, 16, 3); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, 8.5, 0, Math.PI * 2); ctx.fill(); }
    if (p.redacted) { ctx.fillStyle = '#000'; ctx.fillRect(p.x - 9, p.y - 2.5, 18, 5); }
    if (p.req.chainId) {
      ctx.fillStyle = '#a78bfa';
      for (var k = 0; k < p.req.turn; k++) { ctx.beginPath(); ctx.arc(p.x - 6 + k * 6, p.y + 14, 2, 0, Math.PI * 2); ctx.fill(); }
    }
    if (isT && W >= 480) {
      ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#e2e8f0';
      ctx.fillText(p.req.agent, p.x, p.y - 22);
    }
  }

  // ---------------------------------------------------------------- DOM UI
  var hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function updateHud(force) {
    if (force) hudCache = {};
    setText('hudWave', String(G.wave || 1));
    setText('hudScore', G.score.toLocaleString());
    setText('hudCombo', '×' + (1 + Math.min(G.combo, 20) * 0.1).toFixed(1));
    var tb = $('trustBar'), bb = $('budgetBar');
    tb.style.width = clamp(G.trust, 0, 100) + '%'; tb.classList.toggle('low', G.trust < 35);
    var bp = clamp(G.budget / G.budgetMax * 100, 0, 100);
    bb.style.width = bp + '%'; bb.classList.toggle('low', bp < 25);
  }

  function renderRegistry() {
    var ul = $('registryList'); if (!ul || !G) return;
    ul.innerHTML = D.AGENTS.map(function (a) {
      var s = G.agents[a.id], st = s.state;
      var label = st === 'compromised' ? 'compromised' : st === 'revoking' ? 'disabling…' : st === 'disabled' ? 'disabled' : 'active';
      return '<li class="reg-item ' + st + '">' +
        '<span class="reg-dot" style="background:' + CLOUD[a.cloud] + '"></span>' +
        '<span>' + esc(a.id) + '<br><span class="reg-cloud">' + (a.cloud === 'aws' ? 'AWS' : 'Google Cloud') + '</span></span>' +
        '<span class="reg-state">' + label + '</span>' +
        (st === 'compromised' ? '<button class="reg-disable" type="button" data-agent="' + esc(a.id) + '">Disable in registry</button>' : '') +
        '</li>';
    }).join('');
  }

  function renderInspector() {
    var p = G && G.target;
    var agentEl = $('inspAgent'), typeEl = $('inspType'), turnEl = $('inspTurn'), trailEl = $('inspTrail'), textEl = $('inspText');
    var btns = document.querySelectorAll('.act');
    if (!p) {
      agentEl.textContent = '—'; agentEl.className = 'chip';
      typeEl.textContent = G && G.running ? 'no request selected' : 'waiting for traffic';
      turnEl.hidden = true; trailEl.hidden = true;
      textEl.textContent = 'Requests appear here as they approach the gateway.';
      btns.forEach(function (b) { b.disabled = true; });
      return;
    }
    btns.forEach(function (b) { b.disabled = false; });
    var a = G.agents[p.req.agent];
    agentEl.textContent = p.req.agent + (a.state === 'compromised' ? ' ⚠ compromised' : '');
    agentEl.className = 'chip ' + a.cloud;
    typeEl.textContent = p.req.isTool ? 'MCP tool call' : 'model call';
    if (p.req.chainId) {
      turnEl.hidden = false; turnEl.textContent = 'conversation turn ' + p.req.turn + ' of 3';
      trailEl.hidden = !p.req.trail.length;
      trailEl.innerHTML = p.req.trail.map(function (t, i) { return '<li data-turn="T' + (i + 1) + '">' + esc(t) + '</li>'; }).join('');
    } else { turnEl.hidden = true; trailEl.hidden = true; }
    textEl.innerHTML = p.req.isTool ? '<span class="tool-tag">tool ›</span> ' + esc(p.req.text) : esc(p.req.text);
  }

  var toastTimer = 0;
  function toast(msg) { var t = $('toast'); t.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.textContent = ''; }, 1800); }
  function showBanner(msg, kind, secs) {
    var b = $('banner'); b.textContent = msg; b.className = 'banner' + (kind === 'info' ? ' info' : ''); b.hidden = false;
    G.bannerUntil = G.time + (secs || 3);
  }
  function hideBanner() { $('banner').hidden = true; G.bannerUntil = 0; }

  function flashBtn(act) {
    var b = document.querySelector('.act[data-act="' + act + '"]'); if (!b) return;
    b.classList.add('flash'); setTimeout(function () { b.classList.remove('flash'); }, 140);
  }

  function act(a) {
    if (!G || !G.running || G.paused) return;
    var p = G.target;
    if (!p) { toast('No request selected.'); return; }
    flashBtn(a);
    decide(p, a, false);
  }

  // ---------------------------------------------------------------- waves & end
  function outcomeLabel(m) {
    return {
      breach: m.auto ? 'Reached the model undecided' : 'Breach',
      false: 'False block', falseDisable: 'Healthy agent disabled',
      over: 'Over-blocked', partial: 'Agent left running'
    }[m.outcome] || m.outcome;
  }
  function actionWord(a) { return { allow: 'allow', block: 'block', redact: 'redact', disable: 'disable the agent' }[a]; }

  function missHtml(list) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length && out.length < 4; i++) {
      var m = list[i], key = m.outcome + m.req.cat;
      if (seen[key]) continue; seen[key] = 1;
      var post = m.req.post;
      var why = m.outcome === 'over' ? 'Redacting would have kept the request useful while removing the personal data.'
              : m.outcome === 'partial' ? 'Blocking stopped that one request, but a compromised agent keeps sending. Disable it in the registry.'
              : m.outcome === 'falseDisable' ? 'This agent was healthy. Disabling it took a working service offline for everyone who depends on it.'
              : m.req.explain;
      out.push('<div class="miss"><p class="miss-head"><b>' + esc(outcomeLabel(m)) + '</b> · ' + esc(m.req.agent) +
        ' · should ' + esc(actionWord(m.req.action)) + '</p>' +
        '<p class="miss-req">' + esc(m.req.text.length > 140 ? m.req.text.slice(0, 137) + '…' : m.req.text) + '</p>' +
        '<p class="miss-why">' + esc(why) + (post ? ' <a href="/blog/' + post.slug + '" target="_blank" rel="noopener">Read: ' + esc(post.title) + ' ↗</a>' : '') + '</p></div>');
    }
    return out.join('');
  }

  function waveDone() {
    G.running = false;
    // An agent left compromised at the end of the wave is a containment failure.
    if (G.rogue && G.agents[G.rogue] && G.agents[G.rogue].state === 'compromised') {
      G.trust -= 10;
      G.mistakes.push({ outcome: 'partial', req: makeReq('rogue', 'Agent ' + G.rogue + ' was still live at the end of the wave.', G.rogue), act: 'block' });
      if (G.trust <= 0) return endShift('trust');
    }
    G.rogue = null; hideBanner();
    if (G.wave >= WAVES) return endShift('complete');
    Snd.cleared();
    var w = G.waveStats;
    $('debriefEyebrow').textContent = 'Wave ' + G.wave + ' of ' + WAVES + ' complete';
    $('debriefTitle').textContent = w.breaches ? w.breaches + ' breach' + (w.breaches > 1 ? 'es' : '') + ' this wave' : 'Clean wave';
    $('debriefStats').innerHTML = stat(w.correct + '/' + w.handled, 'correct', 'good') + stat(w.breaches, 'breaches', w.breaches ? 'bad' : '') +
      stat(w.falseBlocks, 'false blocks', w.falseBlocks ? 'bad' : '') + stat(Math.round(w.tokens), 'tokens spent') + stat(G.score.toLocaleString(), 'score');
    $('debriefList').innerHTML = G.mistakes.length ? missHtml(G.mistakes) : '<p class="clean">No mistakes. Every request got the right decision.</p>';
    $('nextWaveBtn').innerHTML = 'Start wave ' + (G.wave + 1) + ' <kbd>Enter</kbd>';
    showOverlay('debriefOverlay');
  }
  function stat(v, label, cls) { return '<div class="stat ' + (cls || '') + '"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></div>'; }

  function grade(t) {
    var acc = t.handled ? t.correct / t.handled : 0;
    if (t.breaches === 0 && acc >= 0.95) return 'S';
    if (t.breaches <= 2 && acc >= 0.9) return 'A';
    if (t.breaches <= 5 && acc >= 0.85) return 'B';
    if (t.breaches <= 9) return 'C';
    return 'D';
  }

  function endShift(reason) {
    G.running = false; G.over = true; hideBanner();
    var t = G.totals, g = grade(t);
    var bk = bestKey(), best = parseInt(store(bk) || '0', 10), isBest = G.score > best;
    if (isBest) store(bk, String(G.score));
    if (reason === 'complete') Snd.cleared(); else Snd.breach();
    $('reportTitle').textContent = reason === 'complete' ? 'Shift complete — grade ' + g
      : reason === 'trust' ? 'Shift ended in wave ' + G.wave + ': trust lost' : 'Shift ended in wave ' + G.wave + ': token budget exhausted';
    $('reportReason').textContent = reason === 'complete'
      ? 'You ran the gateway for all ' + WAVES + ' waves.' + (isBest ? ' New personal best.' : '')
      : reason === 'trust' ? 'Too many breaches and false blocks. The business switched the gateway to fail-closed and paged the on-call team.'
      : 'A runaway request or too much allowed traffic spent the wave’s token budget. Budgets at the gateway exist for exactly this.';
    var lat = t.latencyN ? (t.latencySum / t.latencyN) : 0;
    $('reportStats').innerHTML = stat(G.score.toLocaleString(), 'score', 'good') + stat(g, 'grade') +
      stat(t.correct + '/' + t.handled, 'correct') + stat(t.breaches, 'breaches', t.breaches ? 'bad' : '') +
      stat(t.falseBlocks, 'false blocks', t.falseBlocks ? 'bad' : '') + stat(t.contained, 'agents contained') +
      stat(lat.toFixed(1) + ' s', 'avg decision time') + stat(Math.round(t.tokens), 'tokens spent');
    drawReportCard(g, reason, lat);
    showOverlay('reportOverlay');
  }

  function drawReportCard(g, reason, lat) {
    var c = $('reportCard'), x = c.getContext('2d'), t = G.totals;
    x.fillStyle = '#0b0d14'; x.fillRect(0, 0, 1200, 630);
    x.strokeStyle = 'rgba(42,48,71,.6)'; x.lineWidth = 1;
    for (var i = 0; i < 1200; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 630); x.stroke(); }
    for (var j = 0; j < 630; j += 40) { x.beginPath(); x.moveTo(0, j); x.lineTo(1200, j); x.stroke(); }
    x.fillStyle = '#10b981'; x.fillRect(0, 0, 14, 630);
    x.fillStyle = '#10b981'; x.font = '700 26px "JetBrains Mono", monospace'; x.fillText('INCIDENT REPORT', 70, 90);
    x.fillStyle = '#f4f7ff'; x.font = '700 64px "Space Grotesk", sans-serif'; x.fillText('Guardrail Gauntlet', 70, 165);
    x.fillStyle = '#8b95a8'; x.font = '28px "Space Grotesk", sans-serif';
    x.fillText((reason === 'complete' ? 'Ran the AI gateway for all 8 waves' : 'Shift ended in wave ' + G.wave) + '  \u00b7  speed ' + speed, 70, 212);
    // grade
    x.fillStyle = g === 'S' || g === 'A' ? '#10b981' : g === 'B' ? '#f59e0b' : '#ef4444';
    x.font = '700 200px "Space Grotesk", sans-serif'; x.textAlign = 'right'; x.fillText(g, 1130, 250); x.textAlign = 'left';
    var cells = [
      [G.score.toLocaleString(), 'score'], [t.correct + '/' + t.handled, 'correct decisions'],
      [String(t.breaches), 'breaches'], [String(t.falseBlocks), 'false blocks'],
      [String(t.contained), 'agents contained'], [lat.toFixed(1) + ' s', 'avg decision time']
    ];
    cells.forEach(function (cl, k) {
      var cx = 70 + (k % 3) * 360, cy = 320 + Math.floor(k / 3) * 120;
      x.fillStyle = '#141824'; x.fillRect(cx, cy, 330, 96);
      x.fillStyle = '#f4f7ff'; x.font = '700 40px "JetBrains Mono", monospace'; x.fillText(cl[0], cx + 22, cy + 52);
      x.fillStyle = '#8b95a8'; x.font = '20px "Space Grotesk", sans-serif'; x.fillText(cl[1], cx + 22, cy + 82);
    });
    x.fillStyle = '#f59e0b'; x.font = '700 24px "JetBrains Mono", monospace'; x.textAlign = 'right';
    x.fillText('datadinosaur.com/gauntlet', 1130, 600); x.textAlign = 'left';
    if (dino.complete && dino.naturalWidth) x.drawImage(dino, 70, 556, 52, 52);
  }

  function shareText() {
    var t = G.totals;
    return 'I ran the AI gateway in Guardrail Gauntlet (speed ' + speed + '): grade ' + grade(t) + ', ' + G.score.toLocaleString() + ' points, ' +
      t.breaches + ' breach' + (t.breaches === 1 ? '' : 'es') + ', ' + t.contained + ' compromised agent' + (t.contained === 1 ? '' : 's') +
      ' contained. ' + SITE + '/gauntlet/';
  }

  // ---------------------------------------------------------------- overlays & flow
  var OVERLAYS = ['startOverlay', 'debriefOverlay', 'pauseOverlay', 'reportOverlay'];
  function showOverlay(id) {
    OVERLAYS.forEach(function (o) { $(o).hidden = o !== id; });
    var btn = $(id).querySelector('.btn-primary'); if (btn) setTimeout(function () { btn.focus(); }, 30);
  }
  function hideOverlays() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); canvas.focus && canvas.focus(); }
  function currentOverlay() { for (var i = 0; i < OVERLAYS.length; i++) if (!$(OVERLAYS[i]).hidden) return OVERLAYS[i]; return null; }

  function bestKey() { return 'gg-best3'; }
  function showBest() {
    var b = parseInt(store(bestKey()) || '0', 10);
    $('bestScore').textContent = b ? 'Your best: ' + b.toLocaleString() : '';
  }
  function speedHint() {
    return 'A request takes about ' + Math.round(baseTravel(1) * K()) + ' s to cross the screen in wave 1, ' +
      Math.round(baseTravel(8) * K()) + ' s in wave 8.';
  }
  function setSpeed(v, fromInput) {
    v = Math.round(Number(v));
    if (!(v >= SPEED_MIN && v <= SPEED_MAX)) v = SPEED_DEFAULT;
    speed = v; store('gg-speed2', String(v));
    Array.prototype.forEach.call(document.querySelectorAll('.speed-range'), function (r) { if (r !== fromInput) r.value = v; });
    Array.prototype.forEach.call(document.querySelectorAll('.speed-val'), function (el) { el.textContent = v; });
    Array.prototype.forEach.call(document.querySelectorAll('.speed-hint'), function (el) { el.textContent = speedHint(); });
    applySpeed();
  }
  function begin() {
    Snd.init();
    newGame(); layout(); hideOverlays(); startWave(1);
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: '/gauntlet/start', title: 'Gauntlet start', event: true }); } catch (e) {}
  }
  function nextWave() { Snd.init(); hideOverlays(); startWave(G.wave + 1); }
  function setPaused(p) {
    if (!G || !G.running || G.over) return;
    G.paused = p;
    if (p) showOverlay('pauseOverlay'); else hideOverlays();
  }

  // ---------------------------------------------------------------- input
  document.addEventListener('keydown', function (e) {
    if (e.target && /textarea|select/i.test(e.target.tagName)) return;
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'range' && e.key !== 'Enter') return;
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    var k = e.key.toLowerCase(), ov = currentOverlay();
    if (k === 'm') { Snd.setMuted(!Snd.muted); return; }
    if (ov) {
      if (k === 'enter') {
        e.preventDefault();
        if (ov === 'startOverlay' || ov === 'reportOverlay') begin();
        else if (ov === 'debriefOverlay') nextWave();
        else if (ov === 'pauseOverlay') setPaused(false);
      } else if ((k === 'p' || k === 'escape') && ov === 'pauseOverlay') setPaused(false);
      return;
    }
    if (k === 'p' || k === 'escape') { setPaused(true); return; }
    if (k === 'tab') {
      e.preventDefault();
      var list = targetable(); if (!list.length) return;
      var i = list.indexOf(G.target);
      G.manualTarget = list[(i + (e.shiftKey ? list.length - 1 : 1)) % list.length];
      return;
    }
    var map = { a: 'allow', s: 'block', d: 'redact', f: 'disable', '1': 'allow', '2': 'block', '3': 'redact', '4': 'disable' };
    if (map[k]) { e.preventDefault(); act(map[k]); }
  });

  document.querySelectorAll('.act').forEach(function (b) {
    b.addEventListener('click', function () { act(b.dataset.act); });
  });
  canvas.addEventListener('pointerdown', function (e) {
    if (!G || !G.running) return;
    var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    var best = null, bd = 34;
    targetable().forEach(function (p) { var d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } });
    if (best) G.manualTarget = best;
  });
  $('registryList').addEventListener('click', function (e) {
    var b = e.target.closest('.reg-disable'); if (!b || !G || !G.running) return;
    if (agentState(b.dataset.agent) !== 'compromised') return;
    Snd.disable(); disableAgent(b.dataset.agent);
    var pts = 300; G.score += pts; G.totals.contained++; G.combo++;
    floatText(L.agentX + 40, L.agentY[b.dataset.agent], '+' + pts + ' contained', '#a78bfa');
    updateHud();
  });
  $('startBtn').addEventListener('click', begin);
  $('againBtn').addEventListener('click', begin);
  $('nextWaveBtn').addEventListener('click', nextWave);
  $('resumeBtn').addEventListener('click', function () { setPaused(false); });
  $('pauseBtn').addEventListener('click', function () { setPaused(!(G && G.paused)); });
  $('muteBtn').addEventListener('click', function () { Snd.setMuted(!Snd.muted); });
  $('downloadBtn').addEventListener('click', function () {
    var a = document.createElement('a'); a.download = 'guardrail-gauntlet-report.png';
    a.href = $('reportCard').toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove();
  });
  $('copyBtn').addEventListener('click', function () {
    var b = $('copyBtn'), txt = shareText();
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy result'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () { window.prompt('Copy this:', txt); });
    else window.prompt('Copy this:', txt);
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && G && G.running && !G.paused) setPaused(true); });
  window.addEventListener('resize', function () { layout(); });

  // ---------------------------------------------------------------- loop
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G && G.running && !G.paused) { update(dt); if (G.running) updateHud(); }
    render();
    requestAnimationFrame(frame);
  }

  // Read-only peek at the state for debugging from the console.
  window.GG_STATE = function () { return G; };
  // Advance the simulation by `sec` seconds (testing in a background tab,
  // where requestAnimationFrame doesn't fire).
  window.GG_STEP = function (sec) {
    for (var s = 0; s < sec && G.running && !G.paused; s += 1 / 60) { update(1 / 60); if (G.running) updateHud(); }
    render();
  };
  window.GG_ACT = act;

  // boot
  Snd.setMuted(Snd.muted);
  newGame(); layout(); renderInspector();
  Array.prototype.forEach.call(document.querySelectorAll('.speed-range'), function (r) {
    r.min = SPEED_MIN; r.max = SPEED_MAX;
    r.addEventListener('input', function () { setSpeed(r.value, r); });
  });
  document.querySelectorAll('.speed-reset').forEach(function (b) { b.addEventListener('click', function () { setSpeed(SPEED_DEFAULT); }); });
  setSpeed(store('gg-speed2') || SPEED_DEFAULT);
  showBest();
  requestAnimationFrame(frame);
})();
