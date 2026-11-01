/* FAILSPAN: Structural Mayhem - web version.
 * Campus World (one building per level) -> each class: its own questions, its own bridge project.
 * Right answers earn parts; build joint to joint; Test drives a vehicle across and the truss solver
 * (truss.js) checks every member. Guided build, hints, stars, unlocks, daily streak, badges,
 * English/Bengali, read-aloud for Class 1-3, a weekly challenge, force arrows and a report card.
 */
(function () {
  "use strict";
  const { Design, UnstableStructure, FAILED, RED, YELLOW } = window.BWTruss;
  const { t, setLang, getLang } = window.BWi18n;
  const $ = id => document.getElementById(id);

  // Stratos hooks: ads/analytics are not live; these stay empty / free.
  let startedAt = 0;  // level_start starts the clock; level_complete / game_over carry `seconds` played
  function track(name, details) { try { details = Object.assign({}, details); if (name === "level_start") startedAt = Date.now(); else if ((name === "level_complete" || name === "game_over") && startedAt && details.seconds == null) details.seconds = Math.round((Date.now() - startedAt) / 1000); var S = window.Stratos || parent.Stratos; if (S) S.track(name, details); } catch (e) {} }
  function offerReward(onDone) { onDone(); }

  const CORRECT_CASH = 10000, CORRECT_PTS = 4, WRONG_CASH = 1000, WRONG_PTS = 1, SUBSIDY_PER_POINT = 2500;
  const PREVIEW_QS = 5, PREVIEW_HOURS = 5;   // a locked building lets you try 5 questions every 5 hours
  const HALF_AT = 0.5, FULL_AT = 1;          // previous class covered 50% -> this class half open; 100% -> fully open
  const DAILY_GOAL = 5, DAILY_BONUS_PARTS = 10, BRIDGE_STAR_GOAL = 10, TEST_SECONDS = 5;
  const SHORT = { 15: "BE", 13: "NIT", 14: "IIT", 16: "EXP" };
  const ZONE = ["#14532d", "#1e3a5f", "#3b1f5c", "#5c3a1a", "#5c1a2a"];
  const PROJECT_NAMES = ["Tension Fibers", "Coplanar Trusses", "Parabolic Thrust", "Stay Dynamics", "Matrix Dissipation"];
  const MAT_SHORT = { "Steel cable": "Steel cable", "Carbon-fibre cable": "Carbon cable", "Steel": "Steel beam",
                      "Timber": "Timber beam", "Concrete": "Concrete beam" };
  const matName = m => t(MAT_SHORT[m] || m);
  // ---- Symbols only, no write-up (user, 01-Nov-2026, all games): buttons keep their symbol, words go. The
  // questions and answers (the lesson), the physics formula, numbers and the language names stay.
  const SYM = true;
  const SUBJ_ICON = { math: "➗", physics: "⚛️", chemistry: "⚗️", biology: "🧬", evs: "🌿", commercials: "🛒",
    economics: "📈", finance: "💰", geography: "🌍", general_safety: "🦺", civil: "🏗️", engineering: "⚙️",
    computer: "💻", bridge: "🌉" };
  const MAT_ICON = { "Steel cable": "🔗", "Carbon-fibre cable": "⛓️", "Steel": "🔩", "Timber": "🪵", "Concrete": "🧱" };
  const WORD_ICON = { "Clear": "🧹", "STRESS": "📈", "All": "✳️", "2D": "2D" };
  // the leading symbol of a label ("🗑 Delete" -> "🗑", "◀ World" -> "◀"), or a symbol for a plain word
  const sym = (label, word) => {
    if (!SYM) return label;
    const m = String(label).match(/^[^\p{L}\p{N}]+/u);
    return m && m[0].trim() ? m[0].trim() : (WORD_ICON[word || label] || "");
  };
  const RANK_ICON = { "Expert Engineer": "🏆", "Chief Engineer": "🥇", "Site Engineer": "🥈", "Junior Engineer": "🥉", "Trainee": "🔰" };
  const classSym = info => !SYM ? lname(info) : /^Class \d+$/.test(info.name) ? "🏫 " + info.name.slice(6)
    : /^Expert/.test(info.name) ? "🏆" : lname(info);   // BE / NIT / IIT stay as they are

  let LV = [], NAMES = {}, CAT = null, HANDBOOK = null;
  const QCACHE = {};
  let S = null;                        // saved progress
  const designs = {};                  // level (or weekly key) -> Design
  let cur = null;                      // the class or challenge being played
  let view = "start";

  // ---------------- saved progress (localStorage, never required) ----------------
  const KEY = "failspan-v1";
  function fresh() {
    return { start: -1, score: 0, best: 0, treasury: 50000000, vehicles: 0, muted: false, lang: "en", autoRead: true,
             correct: {}, bridgeCorrect: {}, complete: {}, bestParts: {}, builds: {}, parts: {},
             streak: 0, lastDaily: "", dailyDate: "", dailyCount: 0, answered: 0, badges: {}, weekly: { week: -1, best: null, build: [] },
             preview: {}, done: {}, doneN: {}, view3d: false, lowGfx: false };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === "object") return Object.assign(fresh(), s); } catch (e) {}
    return fresh();
  }
  function save() {
    if (cur && !cur.weekly) { S.builds[cur.level] = cur.design.members; S.parts[cur.level] = cur.design.parts; }
    if (cur && cur.weekly) S.weekly.build = cur.design.members;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }

  // ---------------- sound: short synth effects for actions only ----------------
  let actx = null;
  function tone(freq, dur, type = "sine", vol = 0.12, when = 0) {
    if (S.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const at = actx.currentTime + when, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(actx.destination); o.start(at); o.stop(at + dur);
    } catch (e) {}
  }
  const sfx = {
    place: () => tone(520, 0.08, "square", 0.06),
    remove: () => tone(260, 0.1, "square", 0.05),
    right: () => { tone(660, 0.12); tone(880, 0.16, "sine", 0.12, 0.1); },
    wrong: () => tone(160, 0.25, "sawtooth", 0.07),
    snap: () => { tone(90, 0.35, "sawtooth", 0.12); tone(60, 0.4, "square", 0.08, 0.05); },
    pass: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.22, "triangle", 0.12, k * 0.12)),
    unlock: () => [392, 523, 659].forEach((f, k) => tone(f, 0.18, "sine", 0.1, k * 0.09)),
  };

  // ---------------- read aloud (speech synthesis, Class 1-3 by default) ----------------
  function speak(text, bn) {
    if (S.muted || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = bn ? "bn-IN" : "en-IN"; u.rate = 0.9;
      const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(bn ? "bn" : "en-in"));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function stopSpeech() { try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) {} }

  // ---------------- helpers ----------------
  const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
  const order = () => LV.map(l => l.l);
  const idxOf = level => order().indexOf(level);
  const lname = info => /^Class \d+$/.test(info.name) ? t("Class {n}", { n: info.name.slice(6) }) : t(info.name);
  const sname = s => t(NAMES[s] || s);
  // ---- how much of each class is open ----
  // Every question answered right at least once is marked in a bit set per class (saved as base64).
  // Coverage = share of a class's bank answered right. When the previous class reaches 50% coverage this
  // class opens half its questions (every second one, so every subject is there); at 100% it opens fully.
  // Classes up to the player's own class are fully open from the start.
  const DONE = {};
  const levelN = level => LV[idxOf(level)].n;
  function bits(level) {
    if (!DONE[level]) {
      const b = new Uint8Array(Math.ceil(levelN(level) / 8)), saved = S.done[level];
      if (saved) { try { const raw = atob(saved); for (let i = 0; i < Math.min(raw.length, b.length); i++) b[i] = raw.charCodeAt(i); } catch (e) {} }
      DONE[level] = b;
    }
    return DONE[level];
  }
  const isDone = (level, i) => !!(bits(level)[i >> 3] & (1 << (i & 7)));
  function markDone(level, i) {
    const b = bits(level);
    if (b[i >> 3] & (1 << (i & 7))) return;
    b[i >> 3] |= 1 << (i & 7);
    S.done[level] = btoa(String.fromCharCode.apply(null, b));
    S.doneN[level] = (S.doneN[level] || 0) + 1;
  }
  const coverage = level => Math.min(1, (S.doneN[level] || 0) / Math.max(1, levelN(level)));
  const pct = x => Math.floor(x * 100);
  function openShare(level) {
    const k = idxOf(level);
    if (k <= Math.max(0, S.start)) return 1;
    const c = coverage(LV[k - 1].l);
    return c >= FULL_AT ? 1 : c >= HALF_AT ? HALF_AT : 0;
  }
  function unlockedUpTo() {
    let top = 0;
    LV.forEach((l, k) => { if (openShare(l.l) > 0) top = k; });
    return top;
  }
  // locked buildings: PREVIEW_QS free questions, then wait PREVIEW_HOURS (the window starts at the first try)
  function previewState(level) {
    const pv = S.preview[level];
    if (!pv || Date.now() - pv.start >= PREVIEW_HOURS * 3600e3) return { left: PREVIEW_QS, wait: 0 };
    return { left: Math.max(0, PREVIEW_QS - pv.used), wait: pv.start + PREVIEW_HOURS * 3600e3 - Date.now() };
  }
  function usePreview(level) {
    const st = previewState(level);
    if (st.left === PREVIEW_QS) S.preview[level] = { start: Date.now(), used: 0 };
    S.preview[level].used++;
  }
  const hm = ms => { const m = Math.ceil(ms / 60000); return `${Math.floor(m / 60)}h ${m % 60}m`; };
  const prevClass = level => LV[Math.max(0, idxOf(level) - 1)];
  const isUnlocked = level => openShare(level) > 0;
  function starsOf(level) {
    const p = CAT.projects[LV[idxOf(level)].project - 1];
    return (S.complete[level] ? 1 : 0) + (S.complete[level] && S.bestParts[level] <= p.par_parts ? 1 : 0)
         + ((S.bridgeCorrect[level] || 0) >= BRIDGE_STAR_GOAL ? 1 : 0);
  }
  const starText = n => "★".repeat(n) + "☆".repeat(3 - n);
  // messages queue up and show one after another, so none is missed
  const toasts = [];
  let toastBusy = false;
  function toast(msg, ms = 2200) {
    if (SYM) {                                 // keep the leading symbol and any numbers ("🔥 ... 3-day ... +5" -> "🔥 3 +5")
      const lead = sym(msg), nums = (String(msg).replace(/<[^>]*>/g, "").match(/[+−-]?\d[\d,.]*/g) || []).slice(0, 2).join(" ");
      msg = `${lead} ${nums}`.trim();
      if (!msg) return;
    }
    toasts.push([msg, ms]); if (!toastBusy) nextToast();
  }
  function nextToast() {
    const el = $("toast"), item = toasts.shift();
    if (!item) { toastBusy = false; return; }
    toastBusy = true;
    el.innerHTML = item[0]; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    setTimeout(() => { el.classList.remove("show"); setTimeout(nextToast, 250); }, item[1]);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const today = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
  const weekNo = () => Math.floor((Date.now() / 864e5 + 3) / 7);

  // ---------------- badges ----------------
  const BADGES = [
    ["first", "🎯", "First Answer", s => s.answered >= 1],
    ["bridge1", "👷", "Junior Engineer: first bridge", s => nDone(s) >= 1],
    ["bridge5", "🦺", "Site Engineer: 5 bridges", s => nDone(s) >= 5],
    ["bridge10", "🏗️", "Chief Engineer: 10 bridges", s => nDone(s) >= 10],
    ["bridge16", "🏛️", "Expert Engineer: all 16 bridges", s => nDone(s) >= 16],
    ["q100", "📚", "Quiz Ace: 100 right answers", s => totalCorrect(s) >= 100],
    ["q1000", "🎓", "Scholar: 1,000 right answers", s => totalCorrect(s) >= 1000],
    ["streak3", "🔥", "3-day streak", s => s.streak >= 3],
    ["streak7", "🌟", "7-day streak", s => s.streak >= 7],
    ["streak30", "🏆", "30-day streak", s => s.streak >= 30],
    ["perfect", "💎", "Perfect bridge: 3 stars", s => LV.some(l => starsOf(l.l) === 3)],
    ["thrifty", "🪙", "Thrifty builder: pass within par parts", s => LV.some(l => s.complete[l.l] && s.bestParts[l.l] <= CAT.projects[l.project - 1].par_parts)],
    ["weekly", "🥇", "Weekly champion: pass a weekly challenge", s => s.weekly.best !== null],
  ];
  const nDone = s => Object.values(s.complete).filter(Boolean).length;
  const totalCorrect = s => Object.values(s.correct).reduce((a, b) => a + b, 0);
  function title() {
    const x = [[16, "Expert Engineer"], [10, "Chief Engineer"], [5, "Site Engineer"], [1, "Junior Engineer"]].find(([n]) => nDone(S) >= n);
    return t(x ? x[1] : "Trainee");
  }
  function checkBadges() {
    for (const [key, ic, name, test] of BADGES) {
      if (!S.badges[key] && test(S)) { S.badges[key] = today(); toast(`${ic} ${esc(t("New badge: {s}", { s: t(name) }))}`, 2600); sfx.unlock(); }
    }
  }

  // ---------------- HUD and language ----------------
  function hud() {
    const sub = Math.max(0, S.score * SUBSIDY_PER_POINT);
    if (SYM) {
      const cr = n => n >= 1e7 ? "₹" + (n / 1e7).toFixed(2) + " Cr" : n >= 1e5 ? "₹" + (n / 1e5).toFixed(1) + " L" : inr(n);
      const x = [[16, "Expert Engineer"], [10, "Chief Engineer"], [5, "Site Engineer"], [1, "Junior Engineer"]].find(([n]) => nDone(S) >= n);
      $("stats").innerHTML = `<span>⭐ ${S.score}</span><span>💰 ${cr(S.treasury)}</span><span>🏛 ${cr(sub)}</span>` +
        `<span>🚗 ${S.vehicles}</span><span class="gold">🔥 ${S.streak}</span><span>${RANK_ICON[x ? x[1] : "Trainee"]}</span>`;
    } else if (innerWidth < 560) {
      const cr = n => n >= 1e7 ? "₹" + (n / 1e7).toFixed(2) + " Cr" : n >= 1e5 ? "₹" + (n / 1e5).toFixed(1) + " L" : inr(n);
      $("stats").innerHTML = `<span>⭐ ${S.score}</span><span>${cr(S.treasury)}</span><span>${t("Subsidy")} ${cr(sub)}</span>` +
        `<span>🚗 ${S.vehicles}</span><span class="gold">🔥 ${S.streak}</span>`;
    } else {
      $("stats").innerHTML = `<span>${t("Score")} ${S.score}</span><span>${t("Treasury")} ${inr(S.treasury)}</span>` +
        `<span>${t("Govt Subsidies")} ${inr(sub)}</span><span>🚗 ${S.vehicles}</span>` +
        `<span class="gold">🔥 ${t("{n}-day streak", { n: S.streak })}</span><span>${title()}</span>`;
    }
    $("btn-mute").textContent = S.muted ? "🔇" : "🔊";
    $("btn-lang").textContent = getLang() === "bn" ? "EN" : "বাংলা";
    $("btn-view").textContent = S.view3d ? "2D" : "3D";
    $("btn-view").title = S.view3d ? t("Switch to 2D") : t("Switch to 3D");
    $("btn-3d").hidden = !S.view3d || view !== "class";
    $("btn-3d").textContent = sym(v3.shown ? t("✏️ Build (2D)") : t("🧊 3D view"));
  }

  // ---------------- 2D / 3D: the choice is saved; Three.js loads only when 3D is used ----------------
  const v3 = { view: null, world: null, loading: null, shown: false, wshown: false };
  const lowGfx = () => S.lowGfx || world.lowFx;
  function load3d() {
    if (!v3.loading) v3.loading = import("./view3d.js").then(m => {
      v3.view = m.createBridge($("build3d"), { low: lowGfx() });
      v3.world = m.createWorld($("world3d"), { low: lowGfx(),
        pan: dx => { world.cam += dx; world.clamp(); },
        pick: level => enterOrExplain(level) });
      return v3.view;
    }).catch(e => { console.error(e); v3.loading = null; toast(t("3D could not start on this device. 2D still works.")); throw e; });
    return v3.loading;
  }
  // new canvases + views when "Low graphics" changes (a WebGL canvas keeps its first settings)
  function rebuild3d() {
    if (!v3.view) return;
    for (const id of ["build3d", "world3d"]) { const c = $(id), n = c.cloneNode(false); c.replaceWith(n); }
    v3.view = v3.world = null; v3.loading = null;
    load3d().then(() => { show3d(v3.shown); showWorld3d(v3.wshown); }).catch(() => {});
  }
  function showWorld3d(on) {
    v3.wshown = on && S.view3d;
    $("screen-world").classList.toggle("v3d", v3.wshown);
    if (v3.wshown) load3d().then(() => v3.world && v3.world.setVisible(v3.wshown)).catch(() => { v3.wshown = false; $("screen-world").classList.remove("v3d"); });
    else if (v3.world) v3.world.setVisible(false);
  }
  // what the 3D bridge view needs this frame (the physics is the same solver as 2D)
  function snap3d() {
    const p = cur.project, d = cur.design, all = d.all(), tt = cur.test, res = tt && tt.result;
    return { project: p, members: all, key: p.id + "|" + all.map(m => m.slice(0, 4).join(",")).join(";"), testId: tt ? tt.id : 0,
      colours: all.map(m => { const c = CAT.materials[m[2]].colour; return `rgb(${c[0]},${c[1]},${c[2]})`; }),
      ratios: res ? res.members.map(r => r.status === FAILED ? Math.max(1, r.ratio) : r.ratio) : null,
      slack: res ? res.members.map(r => r.slack) : null,
      failIdx: tt ? tt.failIdx : undefined, status: tt ? tt.status : null, vx: tt ? tt.x : null, worstNow: res ? res.maxRatio : 0 };
  }
  function wsnap3d() {
    const slots = world.slots.map((s, k) => {
      const l = LV[k], done = !!S.complete[l.l], locked = !isUnlocked(l.l);
      return { level: s.level, x: s.x, w: s.w, project: l.project, zone: ZONE[l.project - 1], name: lname(l), done, locked,
               sub: locked ? t("Locked") : openShare(l.l) < 1 ? t("Half open") : starText(starsOf(l.l)) };
    });
    return { slots, width: world.width, center: world.cam + (world.cw || 800) / 2,
             key: getLang() + slots.map(s => s.sub + s.done + s.locked).join("") };
  }
  // the glass HUD over the 3D bridge: live stress %, a small graph, warnings
  const h3 = { id: -1, hist: [] };
  function hud3d() {
    const tt = cur && cur.test, res = tt && tt.result, r = res ? res.maxRatio : 0;
    if (!tt || tt.id !== h3.id) { h3.id = tt ? tt.id : -1; h3.hist = []; }
    if (tt && tt.status === "running" && res) { h3.hist.push(r); if (h3.hist.length > 160) h3.hist.shift(); }
    $("h3pct").textContent = tt && (res || tt.status === "failed") ? `${Math.round((res ? r : 1) * 100)}%` : "--";
    const col = r >= 0.8 || (tt && tt.status === "failed") ? "#ef4444" : r >= 0.5 ? "#f59e0b" : "#22c55e";
    $("h3pct").style.color = col; $("h3bar").style.width = `${Math.min(100, r * 100)}%`; $("h3bar").style.background = col;
    const g = $("h3graph").getContext("2d"), gw = 160, gh = 36;
    g.clearRect(0, 0, gw, gh); g.strokeStyle = "rgba(56,189,248,.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, gh * 0.2); g.lineTo(gw, gh * 0.2); g.stroke();
    if (h3.hist.length > 1) {
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
      h3.hist.forEach((v, k) => { const x = k / 159 * gw, y = gh - Math.min(1.25, v) / 1.25 * gh; if (k) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    }
    const w = $("h3warn");
    let msg = "", cls = "";
    if (tt && tt.status === "failed") { msg = t("💥 STRUCTURAL FAILURE"); cls = "bad"; }
    else if (tt && tt.status === "passed") { msg = t("✔ BRIDGE HOLDS"); cls = "good"; }
    else if (tt && tt.status === "running" && r >= 0.9) { msg = t("⚠ FRACTURE IMMINENT"); cls = "bad pulse"; }
    if (w.dataset.m !== msg + cls) { w.dataset.m = msg + cls; w.textContent = msg; w.className = "g3 warn " + cls; w.hidden = !msg; }
  }
  const after3d = fn => { if (v3.shown) setTimeout(fn, 2300); else fn(); };   // let the 3D collapse play first
  function show3d(on) {
    v3.shown = on && S.view3d;
    $("buildwrap").classList.toggle("v3d", v3.shown);
    if (v3.shown) load3d().then(v => v.setVisible(v3.shown)).catch(() => { v3.shown = false; $("buildwrap").classList.remove("v3d"); hud(); });
    else if (v3.view) v3.view.setVisible(false);
    hud();
  }
  function setView3d(on) {
    S.view3d = on; save(); if (on) load3d().catch(() => {});
    document.body.classList.toggle("mode3d", on);
    show3d(on && view === "class"); showWorld3d(on && view === "world"); buildStart();
  }
  function applyLang() {
    setLang(S.lang);
    document.documentElement.lang = S.lang === "bn" ? "bn" : "en";
    document.querySelectorAll("[data-t]").forEach(el => {
      el.innerHTML = !SYM ? t(el.dataset.t) : el.closest("#screen-start") ? "" : sym(t(el.dataset.t), el.dataset.t);
    });
    hud(); buildStart();
    if (view === "world") buildMinimap();
    if (view === "class" && cur) { renderClassbar(); renderChips(); renderToolbar(); renderInfo(); renderCard(); }
  }

  function show(name) {
    view = name;
    for (const s of ["start", "world", "class"]) $("screen-" + s).classList.toggle("show", s === name);
    if (name !== "class") stopSpeech();
    if (name === "world") { buildMinimap(); resizeWorld(); if (world.focusLevel) world.focus(world.focusLevel); }
    if (name === "class") resizeBuild();
    show3d(name === "class" && S.view3d);
    showWorld3d(name === "world" && S.view3d);
  }
  // mouse wheel scrolls the chip row, toolbar and minimap sideways (they swipe on phones)
  for (const id of ["chips", "toolbar", "minimap"]) $(id).addEventListener("wheel", e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $(id).scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });

  // ---------------- start screen ----------------
  function buildStart() {
    const vp = $("viewpick"); vp.innerHTML = SYM ? "" : `<b>${esc(t("View:"))}</b>`;
    for (const [on, label] of [[false, "2D"], [true, "🧊 3D"]]) {
      const b = document.createElement("button"); b.textContent = label; b.classList.toggle("on", S.view3d === on);
      b.onclick = () => setView3d(on); vp.appendChild(b);
    }
    if (S.view3d) {
      const lg = document.createElement("button"); lg.textContent = SYM ? "⚡" : "⚡ " + t("Low graphics"); lg.classList.toggle("on", !!S.lowGfx);
      lg.title = t("Fewer effects for slow phones");
      lg.onclick = () => { S.lowGfx = !S.lowGfx; save(); buildStart(); rebuild3d(); }; vp.appendChild(lg);
    }
    const g = $("classgrid"); g.innerHTML = "";
    LV.forEach((l, k) => {
      const b = document.createElement("button");
      b.textContent = classSym(l);
      b.onclick = () => { S.start = k; save(); sfx.unlock(); world.focus(l.l); show("world"); };
      g.appendChild(b);
    });
  }

  // ---------------- Campus World ----------------
  const world = {
    cam: 0, drag: null, slots: [], width: 0, t0: performance.now(), lowFx: false, frameMs: [],
    layout() {
      const SP = 300, BW = 170, RIVER = 120;
      let x = 160, last = LV[0].project;
      this.slots = LV.map(l => {
        if (l.project !== last) { x += RIVER; last = l.project; }
        const s = { level: l.l, x, w: BW }; x += SP; return s;
      });
      this.width = x + 160;
    },
    focus(level) { this.focusLevel = level; const s = this.slots.find(s => s.level === level); if (s) this.cam = s.x + s.w / 2 - (this.cw || 800) / 2; this.clamp(); },
    clamp() { if (!isFinite(this.cam)) this.cam = 0; this.cam = Math.max(0, Math.min(this.width - (this.cw || 800), this.cam)); },
  };
  const wc = $("world"), wx = wc.getContext("2d");
  function resizeWorld() {
    const r = wc.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    wc.width = Math.max(1, r.width * d); wc.height = Math.max(1, r.height * d);
    wx.setTransform(d, 0, 0, d, 0, 0); world.cw = r.width; world.ch = r.height; world.clamp();
  }
  function buildMinimap() {
    const m = $("minimap"); m.innerHTML = "";
    const w = document.createElement("button");
    w.textContent = "🏆"; w.title = t("Weekly challenge"); w.className = "weekly"; w.onclick = openWeekly;
    m.appendChild(w);
    LV.forEach(l => {
      const b = document.createElement("button");
      b.textContent = SHORT[l.l] || l.l;
      b.title = lname(l);
      b.className = S.complete[l.l] ? "done" : !isUnlocked(l.l) ? "locked" : openShare(l.l) < 1 ? "half" : "";
      b.onclick = () => enterOrExplain(l.l);
      m.appendChild(b);
    });
  }
  function enterOrExplain(level) {
    if (isUnlocked(level)) { enterLevel(level); return; }
    const st = previewState(level), gate = lname(prevClass(level));
    if (st.left > 0) { enterLevel(level, true); return; }
    world.focus(level);
    lockedModal(level, st.wait, gate);
  }
  function lockedModal(level, wait, gate) {
    modal(`🔒 ${esc(lname(LV[idxOf(level)]))}`,
      `<p>${esc(t("You tried {n} questions of {a}. Come back in {w} for {n} more,", { n: PREVIEW_QS, a: lname(LV[idxOf(level)]), w: hm(wait) }))}</p>
       <p><b>${esc(t("or answer {h}% of {b}'s questions right to open half of this class (now {c}%).",
         { h: pct(HALF_AT), b: gate, c: pct(coverage(prevClass(level).l)) }))}</b></p>`,
      [[t("Go to {b}", { b: esc(gate) }), () => { closeModal(); enterOrExplain(prevClass(level).l); }], [t("Back to the road"), () => { closeModal(); show("world"); }, ""]]);
  }
  function bRect(s) {
    const rank = idxOf(s.level), h = Math.min(world.ch * 0.55, 110 + rank * 8), road = world.ch - 70;
    return { x: s.x - world.cam, y: road - 12 - h, w: s.w, h, road };
  }
  function drawWorld(now) {
    const W = world.cw, H = world.ch;
    if (!W || !H) return;
    const road = H - 70;
    const phase = world.lowFx ? 0.25 : ((now - world.t0) / 180000) % 1;       // day/night every 3 minutes
    const day = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    const sky = wx.createLinearGradient(0, 0, 0, road);
    sky.addColorStop(0, `rgb(${10 + 60 * day},${20 + 110 * day},${45 + 150 * day})`);
    sky.addColorStop(1, `rgb(${20 + 90 * day},${35 + 120 * day},${60 + 120 * day})`);
    wx.fillStyle = sky; wx.fillRect(0, 0, W, road);
    if (day < 0.35 && !world.lowFx) {
      wx.fillStyle = `rgba(255,255,255,${0.8 - day * 2})`;
      for (let k = 0; k < 60; k++) wx.fillRect((k * 137.5 - world.cam * 0.1) % W + (k * 37 % 50), (k * 53) % (road * 0.6), 2, 2);
    }
    const zones = {};
    world.slots.forEach(s => { const p = LV[idxOf(s.level)].project; zones[p] = zones[p] || [s.x, s.x + s.w]; zones[p][1] = s.x + s.w; });
    for (const p in zones) {
      const [a, b] = zones[p];
      wx.fillStyle = ZONE[p - 1]; wx.globalAlpha = 0.45; wx.fillRect(a - 60 - world.cam, 0, b - a + 120, road); wx.globalAlpha = 1;
      wx.fillStyle = "#e2e8f0"; wx.font = "bold 15px Segoe UI, system-ui"; wx.textAlign = "left";
      wx.fillText(`${t("Project {n}", { n: p })}: ${t(PROJECT_NAMES[p - 1])}`, a - 46 - world.cam, 24);
    }
    wx.fillStyle = "#3f3124"; wx.fillRect(0, road, W, H - road);
    wx.fillStyle = "#334155"; wx.fillRect(0, road - 8, W, 26);
    wx.strokeStyle = "#facc15"; wx.lineWidth = 2; wx.setLineDash([20, 20]); wx.lineDashOffset = world.cam % 40;
    wx.beginPath(); wx.moveTo(0, road + 5); wx.lineTo(W, road + 5); wx.stroke(); wx.setLineDash([]);
    for (let k = 1; k < world.slots.length; k++) {
      const a = world.slots[k - 1], b = world.slots[k], pa = LV[k - 1].project, pb = LV[k].project;
      if (pa === pb) continue;
      const x0 = a.x + a.w + 40 - world.cam, x1 = b.x - 40 - world.cam;
      wx.fillStyle = "#0c4a6e"; wx.fillRect(x0, road - 8, x1 - x0, H - road + 8);
      miniBridge(x0, x1, road - 8, pb, LV.some(l => l.project === pb && S.complete[l.l]));
    }
    world.slots.forEach(s => { const r = bRect(s); if (r.x + r.w >= -30 && r.x <= W + 30) drawBuilding(s, r, day); });
    if (!world.lowFx) {
      const n = Math.min(12, S.vehicles);
      for (let k = 0; k < n; k++) {
        const speed = 60 + (k * 17) % 50, dir = k % 2 ? -1 : 1;
        let x = ((now / 1000) * speed * dir + k * 410) % world.width; if (x < 0) x += world.width;
        const sx = x - world.cam, y = road + (dir > 0 ? -4 : 10);
        if (sx < -40 || sx > W + 40) continue;
        wx.fillStyle = ["#facc15", "#f472b6", "#60a5fa", "#4ade80", "#fb923c"][k % 5];
        wx.fillRect(sx - 14, y - 9, 28, 10);
        wx.fillStyle = "#0f172a"; wx.fillRect(sx - 10, y + 1, 6, 4); wx.fillRect(sx + 4, y + 1, 6, 4);
      }
    }
    wx.fillStyle = "#94a3b8"; wx.font = "12px Segoe UI, system-ui"; wx.textAlign = "left";
    wx.fillText(t("Swipe or drag to move along the road · tap a building to enter"), 10, H - 10);
  }
  function miniBridge(x0, x1, y, tier, built) {
    const w = x1 - x0, mid = x0 + w / 2;
    wx.strokeStyle = built ? "#e2e8f0" : "rgba(226,232,240,.35)"; wx.lineWidth = 3;
    wx.beginPath(); wx.moveTo(x0, y); wx.lineTo(x1, y); wx.stroke(); wx.lineWidth = 1.5;
    wx.beginPath();
    if (tier === 2) {
      for (let k = 0; k < 6; k++) { wx.moveTo(x0 + k * w / 6, y); wx.lineTo(x0 + (k + 1) * w / 6, k % 2 ? y : y - 22); }
      wx.moveTo(x0 + w / 6, y - 22); wx.lineTo(x0 + 5 * w / 6, y - 22);
    } else if (tier === 3) {
      for (let k = 0; k <= 10; k++) { const xx = x0 + k * w / 10, yy = y - 38 * (1 - ((k - 5) / 5) ** 2); k ? wx.lineTo(xx, yy) : wx.moveTo(xx, yy); }
    } else {
      wx.moveTo(mid, y + 14); wx.lineTo(mid, y - 48);
      for (let k = 1; k < 6; k++) { wx.moveTo(mid, y - 46); wx.lineTo(x0 + k * w / 6, y); }
    }
    wx.stroke();
  }
  function drawBuilding(s, r, day) {
    const info = LV[idxOf(s.level)], open = isUnlocked(s.level), done = S.complete[s.level], zone = ZONE[info.project - 1];
    const hover = world.pointer && world.pointer.x >= r.x && world.pointer.x <= r.x + r.w && world.pointer.y >= r.y - 30 && world.pointer.y <= r.road;
    wx.fillStyle = open ? shade(zone, 60) : "#475569"; wx.fillRect(r.x, r.y, r.w, r.h);
    wx.strokeStyle = hover ? "#facc15" : "#0f172a"; wx.lineWidth = hover ? 3 : 2; wx.strokeRect(r.x, r.y, r.w, r.h);
    wx.fillStyle = shade(zone, 20); wx.beginPath(); wx.moveTo(r.x - 8, r.y); wx.lineTo(r.x + r.w / 2, r.y - 26); wx.lineTo(r.x + r.w + 8, r.y); wx.fill();
    wx.fillStyle = day < 0.45 || !open ? (open ? "#fde047" : "#64748b") : "#bae6fd";
    for (let y = r.y + 46; y < r.y + r.h - 34; y += 22) for (let x = r.x + 16; x < r.x + r.w - 20; x += 30) wx.fillRect(x, y, 14, 12);
    wx.fillStyle = "#0f172a"; wx.fillRect(r.x + r.w / 2 - 12, r.y + r.h - 30, 24, 30); wx.fillRect(r.x + 10, r.y + 8, r.w - 20, 30);
    wx.fillStyle = "#fff"; wx.font = "bold 15px Segoe UI, system-ui"; wx.textAlign = "center";
    wx.fillText((open ? "" : "🔒 ") + lname(info), r.x + r.w / 2, r.y + 28, r.w - 24);
    if (!open) {
      const st = previewState(s.level);
      wx.fillStyle = "#fde68a"; wx.font = "bold 12px Segoe UI, system-ui";
      wx.fillText(st.left > 0 ? t("Try {n} free questions", { n: st.left }) : t("Back in {w}", { w: hm(st.wait) }), r.x + r.w / 2, r.y + 56, r.w - 16);
    }
    const prog = coverage(s.level);
    if (open && openShare(s.level) < 1) {
      wx.fillStyle = "#fde68a"; wx.font = "bold 12px Segoe UI, system-ui";
      wx.fillText(t("Half open"), r.x + r.w / 2, r.y + 56, r.w - 16);
    }
    wx.fillStyle = "#1e293b"; wx.fillRect(r.x + 10, r.road + 20, r.w - 20, 7);
    wx.fillStyle = "#34d399"; wx.fillRect(r.x + 10, r.road + 20, (r.w - 20) * prog, 7);
    wx.font = "12px Segoe UI, system-ui"; wx.fillStyle = "#e2e8f0";
    wx.fillText(t("{n} Q · {s} subjects", { n: info.n.toLocaleString("en-IN"), s: Object.keys(info.subjects).length }), r.x + r.w / 2, r.road + 42);
    wx.fillStyle = "#facc15"; wx.font = "16px Segoe UI, system-ui"; wx.fillText(starText(starsOf(s.level)), r.x + r.w / 2, r.y - 34);
    if (done) { wx.fillStyle = "#4ade80"; wx.font = "bold 12px Segoe UI, system-ui"; wx.fillText(t("BRIDGE BUILT"), r.x + r.w / 2, r.y - 54); }
  }
  function shade(hex, add) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.min(255, v + add));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  wc.addEventListener("pointerdown", e => { world.drag = { x: e.clientX, cam: world.cam, moved: false }; wc.setPointerCapture(e.pointerId); });
  wc.addEventListener("pointermove", e => {
    const r = wc.getBoundingClientRect(); world.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (world.drag) {
      const dx = e.clientX - world.drag.x;
      if (Math.abs(dx) > 6) world.drag.moved = true;
      if (world.drag.moved) { world.cam = world.drag.cam - dx; world.clamp(); }
    }
  });
  wc.addEventListener("pointerup", e => {
    const d = world.drag; world.drag = null;
    if (d && !d.moved) {
      const r = wc.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      const s = world.slots.find(s => { const b = bRect(s); return px >= b.x && px <= b.x + b.w && py >= b.y - 30 && py <= b.road + 64; });
      if (s) enterOrExplain(s.level);
    }
  });
  wc.addEventListener("wheel", e => { world.cam += (e.deltaY || e.deltaX); world.clamp(); e.preventDefault(); }, { passive: false });

  // ---------------- entering a class ----------------
  async function loadLevel(level) {
    if (!QCACHE[level]) {
      const d = await (await fetch(`data/q/${level}.json`)).json();
      QCACHE[level] = d.q.map((row, i) => ({ i, s: d.s[row[0]], q: row[1], o: row[2], a: row[3], e: row[4], bn: row[5] || null }));
    }
    return QCACHE[level];
  }
  function newCur(extra) {
    return Object.assign({ sel: null, del: false, forces: false, fj: null, fr: null, test: null, guide: false, hint: 0, msg: "", msgClass: "",
                           subject: null, weekly: false }, extra);
  }
  async function enterLevel(level, preview = false) {
    const info = LV[idxOf(level)], project = CAT.projects[info.project - 1];
    if (!designs[level]) {
      const d = new Design(CAT, project);
      d.parts = S.parts[level] || 0;
      for (const m of S.builds[level] || []) if (!d.taken(m[0], m[1])) d.members.push(m);
      designs[level] = d;
    }
    cur = newCur({ level, info, project, design: designs[level], mat: project.materials[0], size: project.sizes[1] || project.sizes[0], preview });
    $("toolbar").hidden = preview;
    $("card").hidden = false; $("chips").hidden = false; $("btn-bank").hidden = false;
    $("card").innerHTML = `<div class="q">${SYM ? "⏳" : esc(t("Loading {name} questions…", { name: lname(info) }))}</div>`;
    show("class");
    renderClassbar(); renderChips(); renderToolbar(); renderInfo();
    if (preview) setMsg(previewLine(level));
    track("level_start", { level, preview });
    cur.all = await loadLevel(level);
    setSubject(null);
  }
  function renderClassbar() {
    if (cur.weekly) {
      $("cl-name").textContent = SYM ? "📅" : t("Weekly challenge"); $("cl-stars").textContent = "🏆";
      $("cl-sub").textContent = `${t(cur.project.name)} · ${t(cur.project.vehicle.name)} ${(cur.project.vehicle.mass / 1000).toFixed(1)} t`;
      return;
    }
    $("cl-name").textContent = (cur.preview ? "🔒 " : "") + classSym(cur.info);
    $("cl-stars").textContent = starText(starsOf(cur.level));
    if (cur.preview) { $("cl-sub").textContent = SYM ? `🔓 ${previewState(cur.level).left}` : previewLine(cur.level); return; }
    const share = openShare(cur.level);
    if (SYM) {                                 // covered % of the bank and the bridge quiz, as numbers
      $("cl-sub").textContent = `${share < 1 ? "½ · " : ""}📊 ${pct(coverage(cur.level))}% · 🌉 ${S.bridgeCorrect[cur.level] || 0}/${BRIDGE_STAR_GOAL}`;
      return;
    }
    $("cl-sub").textContent = (share < 1 ? `${t("Half open")} · ` : "") +
      `${t("Project {n}", { n: cur.project.id })}: ${t(cur.project.name)} · ` +
      t("covered {c}% of {n} questions · bridge quiz {b}/{q}", { c: pct(coverage(cur.level)), n: cur.info.n.toLocaleString("en-IN"),
                                                                 b: S.bridgeCorrect[cur.level] || 0, q: BRIDGE_STAR_GOAL });
  }
  function previewLine(level) {
    return t("Preview: {n} free questions left. Answer {h}% of {b} right to open half of this class (now {c}%).",
      { n: previewState(level).left, h: pct(HALF_AT), b: lname(prevClass(level)), c: pct(coverage(prevClass(level).l)) });
  }
  function renderChips() {
    const c = $("chips"); c.innerHTML = "";
    if (cur.weekly) return;
    const subs = Object.keys(cur.info.subjects);
    const list = [[null, SYM ? "✳️" : t("All")]].concat(subs.includes("bridge") ? [["bridge", SYM ? "🌉" : t("🌉 Bridge quiz")]] : [])
      .concat(subs.filter(s => s !== "bridge").map(s => [s, SYM ? (SUBJ_ICON[s] || sname(s)) : sname(s)]));
    for (const [s, label] of list) {
      const b = document.createElement("button");
      b.textContent = label + (s ? ` ${cur.info.subjects[s]}` : "");
      if (SYM && s) b.title = sname(s);          // hover / long-press only
      if (s === "bridge") b.classList.add("bridge");
      if (s === cur.subject) b.classList.add("on");
      b.onclick = () => setSubject(s);
      c.appendChild(b);
    }
  }
  // random order, keeping look-alike questions (same first words) apart
  function spread(items) {
    const rest = items.slice();
    for (let k = rest.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [rest[k], rest[j]] = [rest[j], rest[k]]; }
    const sig = q => q.q.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
    const out = [], recent = [];
    while (rest.length) {
      let k = rest.slice(0, 300).findIndex(q => !recent.includes(sig(q)));
      if (k < 0) k = 0;
      const q = rest.splice(k, 1)[0]; out.push(q); recent.push(sig(q)); if (recent.length > 6) recent.shift();
    }
    return out;
  }
  function setSubject(s) {
    cur.subject = s;
    const share = cur.preview ? 1 : openShare(cur.level);
    cur.pool = cur.all.filter(q => (s === null || q.s === s) && (share >= 1 || q.i % 2 === 0));
    // questions not yet answered right come first, so the bank really gets covered
    cur.deck = spread(cur.pool.filter(q => !isDone(cur.level, q.i))).concat(spread(cur.pool.filter(q => isDone(cur.level, q.i))));
    cur.qi = 0; cur.answered = false;
    renderChips(); renderCard();
  }

  // ---------------- question card ----------------
  const shown = q => (getLang() === "bn" && q.bn) ? { q: q.bn[0], o: q.bn[1], e: q.bn[2] || q.e, bn: true } : { q: q.q, o: q.o, e: q.e, bn: false };
  const readsAloud = () => cur && !cur.weekly && [1, 2, 3].includes(cur.level);
  function readQuestion() {
    const q = cur.deck[cur.qi % cur.deck.length]; if (!q) return;
    const v = shown(q);
    speak(`${v.q} ${v.o.map((o, k) => `${k + 1}. ${o}.`).join(" ")}`, v.bn);
  }
  function renderCard() {
    if (!cur || cur.weekly || !cur.deck) return;
    const c = $("card"), q = cur.deck[cur.qi % Math.max(1, cur.deck.length)];
    if (!q) { c.innerHTML = `<div class="q">${t("No questions here yet.")}</div>`; return; }
    const v = shown(q);
    const done = S.dailyDate === today() ? Math.min(DAILY_GOAL, S.dailyCount) : 0;
    const daily = SYM ? (done >= DAILY_GOAL ? "📅 ✓" : `📅 ${done}/${DAILY_GOAL}`)
      : done >= DAILY_GOAL ? t("Daily challenge done ✓") : t("Daily challenge: {a}/{b} right today", { a: done, b: DAILY_GOAL });
    const note = getLang() === "bn" && !q.bn ? ` <small>${SYM ? "EN" : t("(English only)")}</small>` : "";
    const auto = readsAloud() ? `<label><input type="checkbox" id="c-auto" ${S.autoRead ? "checked" : ""}> ${SYM ? "🔁" : t("Auto-read")}</label>` : "";
    const headTxt = SYM ? `${SUBJ_ICON[q.s] || esc(sname(q.s))} · ✔ +${cur.project.parts_per_correct} 🔩`
      : `${esc(lname(cur.info))} · ${esc(sname(q.s))} · ${t("right = +{n} parts", { n: cur.project.parts_per_correct })}`;
    c.innerHTML = `<div class="head"><span>${headTxt}${note}</span>` +
      `<span class="daily">${daily}</span></div>` +
      `<div class="qrow"><div class="q">${esc(v.q)}</div><span class="read"><button id="c-read">${sym(t("🔈 Read"))}</button>${auto}</span></div>` +
      `<div class="opts"></div><div class="exp" id="exp"></div>`;
    const opts = c.querySelector(".opts");
    v.o.forEach((o, k) => {
      const b = document.createElement("button");
      b.innerHTML = `<b>${k + 1}.</b> ${esc(o)}`;
      b.onclick = () => answer(k);
      opts.appendChild(b);
    });
    $("c-read").onclick = readQuestion;
    if ($("c-auto")) $("c-auto").onchange = e => { S.autoRead = e.target.checked; save(); if (S.autoRead) readQuestion(); else stopSpeech(); };
    cur.answered = false;
    if (readsAloud() && S.autoRead) readQuestion();
  }
  function answer(k) {
    if (!cur || cur.weekly || cur.answered || !cur.deck || !cur.deck.length) return;
    if (cur.preview && previewState(cur.level).left <= 0) return;
    const sharesBefore = LV.map(l => openShare(l.l));
    if (cur.preview) usePreview(cur.level);
    const q = cur.deck[cur.qi % cur.deck.length], v = shown(q), btns = $("card").querySelectorAll(".opts button");
    cur.answered = true;
    btns.forEach((b, i) => { b.disabled = true; if (i === q.a) b.classList.add("right"); });
    S.answered++;
    let line;
    if (k === q.a) {
      S.score += CORRECT_PTS; S.treasury += CORRECT_CASH; S.best = Math.max(S.best, S.score);
      cur.design.parts += cur.project.parts_per_correct;
      S.correct[cur.level] = (S.correct[cur.level] || 0) + 1;
      markDone(cur.level, q.i);
      if (q.s === "bridge") S.bridgeCorrect[cur.level] = (S.bridgeCorrect[cur.level] || 0) + 1;
      dailyTick(); sfx.right();
      line = `<span>${t("✓ Right! +{n} parts.", { n: cur.project.parts_per_correct })} ${esc(v.e)}</span>`;
    } else {
      btns[k].classList.add("wrong");
      S.score = Math.max(0, S.score - WRONG_PTS); S.treasury = Math.max(0, S.treasury - WRONG_CASH);
      sfx.wrong();
      line = `<span>${esc(t("✗ Answer: {a}.", { a: v.o[q.a] }))} ${esc(v.e)}</span>`;
    }
    $("exp").innerHTML = line + `<button class="primary" id="btn-next">${t("Next ▶")}</button>`;
    $("btn-next").onclick = nextQ;
    announceOpenings(sharesBefore);
    checkBadges(); save(); hud(); renderInfo(); renderClassbar();
  }
  function nextQ() {
    stopSpeech();
    if (cur.preview && previewState(cur.level).left <= 0) {
      lockedModal(cur.level, previewState(cur.level).wait, lname(prevClass(cur.level)));
      return;
    }
    cur.qi++; renderCard();
  }
  function announceOpenings(before) {
    LV.forEach((l, k) => {
      const now = openShare(l.l);
      if (now <= before[k]) return;
      toast(`🔓 ${esc(t(now >= 1 ? "{a} is now fully open!" : "{a} is now half open!", { a: lname(l) }))}`, 3000);
      setTimeout(sfx.unlock, 300); buildMinimap();
    });
  }
  function dailyTick() {
    if (S.dailyDate !== today()) { S.dailyDate = today(); S.dailyCount = 0; }
    S.dailyCount++;
    if (S.dailyCount === DAILY_GOAL) {
      S.streak = S.lastDaily === today(-1) ? S.streak + 1 : S.lastDaily === today() ? S.streak : 1;
      S.lastDaily = today();
      cur.design.parts += DAILY_BONUS_PARTS;
      toast(t("🔥 Daily challenge done! {n}-day streak · +{p} bonus parts", { n: S.streak, p: DAILY_BONUS_PARTS }), 2800);
      sfx.pass();
    }
  }

  // ---------------- weekly challenge: same bridge for everyone this week, fewest parts wins ----------------
  function weeklySpec() {
    const w = weekNo(), base = CAT.projects[w % 5], factor = [1.1, 1.2, 1.3][w % 3];
    const p = JSON.parse(JSON.stringify(base));
    p.vehicle.mass = Math.round(base.vehicle.mass * factor);
    return { w, p, factor };
  }
  function openWeekly() {
    const { w, p, factor } = weeklySpec();
    if (S.weekly.week !== w) S.weekly = { week: w, best: null, build: [] };
    modal(esc(t("🏆 Weekly Bridge Challenge - week {w}", { w: w % 52 + 1 })),
      `<p>${esc(t("This week everyone builds the same bridge: {p} with a {v} {m} t ({x} × heavier than normal). Parts are free - the fewest parts that pass wins. Your best this week: {b}.",
        { p: t(p.name), v: t(p.vehicle.name), m: (p.vehicle.mass / 1000).toFixed(1), x: factor, b: S.weekly.best === null ? t("none yet") : S.weekly.best }))}</p>`,
      [[t("Start the challenge"), () => { closeModal(); enterWeekly(); }]]);
  }
  function enterWeekly() {
    const { w, p } = weeklySpec(), key = "weekly" + w;
    if (!designs[key]) {
      const d = new Design(CAT, p); d.parts = 9999;
      for (const m of S.weekly.build || []) if (!d.taken(m[0], m[1])) { d.members.push(m); d.parts -= CAT.size_cost[m[3]]; }
      designs[key] = d;
    }
    cur = newCur({ level: key, weekly: true, info: null, project: p, design: designs[key], mat: p.materials[0], size: p.sizes[1] || p.sizes[0] });
    $("card").hidden = true; $("chips").hidden = true; $("btn-bank").hidden = true; $("toolbar").hidden = false;
    show("class"); renderClassbar(); renderChips(); renderToolbar();
    setMsg(t("Weekly challenge: parts are free. Build with as few parts as you can, then Test."));
    track("level_start", { level: "weekly", week: w });
  }

  // ---------------- build screen ----------------
  const bc = $("build"), bx = bc.getContext("2d");
  let BW = 0, BH = 0;
  function resizeBuild() {
    const r = bc.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    bc.width = Math.max(1, r.width * d); bc.height = Math.max(1, r.height * d);
    bx.setTransform(d, 0, 0, d, 0, 0); BW = r.width; BH = r.height;
  }
  function viewXf() {
    const p = cur.project, ys = p.joints.map(j => j[1]);
    const top = getComputedStyle($("buildinfo")).position === "absolute" ? 88 : 22, bottom = BH - 24;
    const s = Math.min((BW - 40) / p.span, (bottom - top) / (Math.max(...ys) - Math.min(...ys)));
    return { s, ox: (BW - p.span * s) / 2, oy: top + Math.max(...ys) * s };
  }
  function px(x, y) { const v = viewXf(); return [v.ox + x * v.s, v.oy - y * v.s]; }
  function jointAt(mx, my) {
    let best = null, bd = 22;
    cur.project.joints.forEach((j, k) => { const [x, y] = px(j[0], j[1]), d = Math.hypot(x - mx, y - my); if (d < bd) { best = k; bd = d; } });
    return best;
  }
  function memberAt(mx, my, playerOnly) {
    let best = null, bd = 12;
    cur.design.all().forEach((m, k) => {
      if (playerOnly && m[5] < 0) return;
      const [x1, y1] = px(...cur.project.joints[m[0]]), [x2, y2] = px(...cur.project.joints[m[1]]);
      const dx = x2 - x1, dy = y2 - y1, u = Math.max(0, Math.min(1, ((mx - x1) * dx + (my - y1) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(x1 + u * dx - mx, y1 + u * dy - my);
      if (d < bd) { best = k; bd = d; }
    });
    return best;
  }
  function nextGuided() {
    for (const st of cur.project.steps) for (const m of st.members) if (!cur.design.taken(m[0], m[1])) return { step: st, m };
    return null;
  }
  function setMsg(m, cls = "") { cur.msg = m; cur.msgClass = cls; renderInfo(); }
  function edited() { cur.test = null; cur.fr = null; save(); renderInfo(); }
  const busy = () => cur && cur.test && cur.test.status === "running";
  // translate a design message (they come from truss.js in English)
  function tmsg(msg) {
    const m = msg.match(/^Need (\d+) parts for size (\w+)/);
    if (m) return t("Need {c} parts for size {s} - answer questions to earn parts.", { c: m[1], s: m[2] });
    return t(msg);
  }

  function renderInfo() {
    if (!cur) return;
    const p = cur.project, d = cur.design;
    let msg = cur.msg, cls = cur.msgClass;
    if (!msg) { msg = cur.guide ? guideLine() : t("Physics: {s}", { s: t(p.lesson) }); cls = ""; }
    const partsTxt = cur.weekly ? `${t("Weekly challenge")} · ${d.partsUsed()}` :
      `${t("Parts {p} (+{n} per right answer)", { p: d.parts, n: p.parts_per_correct })} · ${t("par {p} parts (used {u})", { p: p.par_parts, u: d.partsUsed() })}`;
    if (SYM) {
      const formula = (() => { const L = String(p.lesson || ""); const k = L.lastIndexOf(": "); const f = k >= 0 ? L.slice(k + 2) : ""; return /=/.test(f) ? f.replace(/\.$/, "") : ""; })();
      const n = cur.guide ? nextGuided() : null;
      const line = cur.guide ? (n ? `🧭 ${cur.project.steps.indexOf(n.step) + 1}/${cur.project.steps.length} · ${MAT_ICON[n.m[2]] || ""} ${n.m[3]}` : "🧭 ✓ → 🚗") : (formula ? `📐 ${formula}` : "");
      const parts = cur.weekly ? `📅 🔩 ${d.partsUsed()}` : `🔩 ${d.parts} (+${p.parts_per_correct}) · 🎯 ${p.par_parts} (${d.partsUsed()})`;
      $("buildinfo").innerHTML = `<div class="parts">${parts} · 🚗 ${(p.vehicle.mass / 1000).toFixed(1)} t${p.impact !== 1 ? " · 💥 ×" + p.impact : ""} · ↔ ${p.span} m</div>` +
        `<div class="msg">${esc(line)}</div>`;
      return;
    }
    $("buildinfo").innerHTML = `<div class="goal">${esc(t(p.goal))}</div>` +
      `<div class="parts">${partsTxt} · ${esc(t(p.vehicle.name))} ${(p.vehicle.mass / 1000).toFixed(1)} t` +
      `${p.impact !== 1 ? " " + t("× {n} impact", { n: p.impact }) : ""} · ${t("span {n} m", { n: p.span })}</div>` +
      `<div class="msg ${cls}">${esc(msg)}</div>`;
  }
  function guideLine() {
    const n = nextGuided();
    if (!n) return t("Guide: everything is built - press Test!");
    return t("Guide step {k}/{n}: {s} Glowing joints = next member ({m}).",
      { k: cur.project.steps.indexOf(n.step) + 1, n: cur.project.steps.length, s: t(n.step.text), m: `${matName(n.m[2])} ${n.m[3]}` });
  }

  function renderToolbar() {
    const tb = $("toolbar"), p = cur.project; tb.innerHTML = "";
    if (cur.preview) return;
    const add = (label, fn, on, cls) => {
      const b = document.createElement("button");
      b.textContent = SYM ? (sym(label, label) || label) : label; if (SYM) b.title = label;
      b.onclick = fn; if (on) b.classList.add("on"); if (cls) b.classList.add(cls); tb.appendChild(b); return b;
    };
    const sep = () => { const s = document.createElement("span"); s.className = "sep"; tb.appendChild(s); };
    p.materials.forEach(m => add(SYM ? (MAT_ICON[m] || matName(m)) : matName(m), () => { cur.mat = m; renderToolbar(); }, cur.mat === m));
    sep();
    p.sizes.forEach(s => add(`${s} (${CAT.size_cost[s]})`, () => { cur.size = s; renderToolbar(); }, cur.size === s));
    sep();
    add(t("🗑 Delete"), () => { cur.del = !cur.del; cur.forces = false; cur.sel = null; setMsg(cur.del ? t("Delete mode: tap a member you built to remove it (parts come back).") : ""); renderToolbar(); }, cur.del);
    add(t("↶ Undo"), undo);
    add(SYM ? "🧹" : t("Clear"), () => { if (!busy()) { cur.design.clear(); cur.sel = null; setMsg(t("Cleared - all parts returned.")); edited(); } });
    sep();
    add(t("🔍 Forces"), () => { cur.forces = !cur.forces; cur.del = false; cur.sel = null; cur.fj = null; setMsg(cur.forces ? t("Forces mode: tap a joint to see the pushes and pulls on it.") : ""); renderToolbar(); }, cur.forces);
    add(t("💡 Hint"), hint);
    add(t("▶ Show me"), showMe);
    add(t("🚗 Test bridge"), startTest, false, "go");
  }
  function undo() {
    if (!busy() && cur.design.members.length) { cur.design.remove(cur.design.members.length - 1); sfx.remove(); setMsg(t("Undone - parts returned.")); edited(); }
  }
  function hint() {
    const hs = cur.project.hints;
    const give = () => { setMsg(t("Hint {k}/{n}: {s}", { k: cur.hint + 1, n: hs.length, s: t(hs[cur.hint]) })); cur.hint = (cur.hint + 1) % hs.length; };
    if (cur.hint === hs.length - 1) { track("reward_offered", { kind: "hint" }); offerReward(() => { track("reward_taken", { kind: "hint" }); give(); }); }
    else give();
  }
  function showMe() {
    if (busy()) return;
    const n = nextGuided();
    cur.guide = true; $("btn-guide").classList.add("on");
    if (!n) { setMsg(t("Everything in the guide is built. Press Test bridge!"), "good"); return; }
    const msg = cur.design.add(n.m[0], n.m[1], n.m[2], n.m[3]);
    const label = `${matName(n.m[2])} ${n.m[3]}`;
    if (msg) { setMsg(t("{msg} Next: {m} between the glowing joints.", { msg: tmsg(msg), m: label }), "bad"); return; }
    sfx.place(); cur.mat = n.m[2]; cur.size = n.m[3]; renderToolbar();
    setMsg(t("Built {m} for you. {s}", { m: label, s: t(n.step.text) }), "good"); edited();
  }

  // force arrows at a joint, with the vehicle parked mid-span (or at its spot during a test)
  function forcesAt(j) {
    cur.fj = j;
    if (cur.test && cur.test.result) { cur.fr = cur.test.result; }
    else {
      try { cur.fr = cur.design.solveAt(cur.project.span / 2 + cur.design.vehicleLength() / 2); }
      catch (e) { if (!(e instanceof UnstableStructure)) throw e; cur.fr = null; setMsg(t("The frame can wobble - build more before reading forces."), "bad"); return; }
    }
    setMsg(t("Forces at this joint with the {v} parked mid-span. Blue arrows pull (tension), red arrows push (compression). They balance: ΣF = 0.",
      { v: t(cur.project.vehicle.name) }));
  }

  bc.addEventListener("contextmenu", e => e.preventDefault());
  bc.addEventListener("pointerdown", e => {
    if (!cur || busy() || cur.preview) return;
    const r = bc.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (cur.forces) { const j = jointAt(mx, my); if (j !== null) forcesAt(j); return; }
    if (e.button === 2 || cur.del) {
      const k = memberAt(mx, my, true);
      if (k !== null) { cur.design.remove(cur.design.all()[k][5]); sfx.remove(); setMsg(t("Removed - parts returned.")); edited(); }
      return;
    }
    const j = jointAt(mx, my);
    if (j === null) { cur.sel = null; return; }
    if (cur.sel === null) { cur.sel = j; setMsg(t("Now tap the joint at the other end.")); return; }
    if (j === cur.sel) { cur.sel = null; setMsg(""); return; }
    const msg = cur.design.add(cur.sel, j, cur.mat, cur.size);
    if (msg) { setMsg(tmsg(msg), "bad"); sfx.wrong(); }
    else { sfx.place(); setMsg(t("Built {m}.", { m: `${matName(cur.mat)} ${cur.size}` })); edited(); cur.sel = j; }
  });
  bc.addEventListener("pointermove", e => { const r = bc.getBoundingClientRect(); if (cur) cur.mouse = [e.clientX - r.left, e.clientY - r.top]; });

  let testSerial = 0;
  function startTest() {
    if (busy()) return;
    cur.sel = null; cur.del = false; cur.forces = false; cur.fj = null; renderToolbar();
    cur.test = { x: 0, status: "running", result: null, worst: 0, id: ++testSerial };
    if (S.view3d && !v3.shown) show3d(true);   // build in 2D, watch the test drive in 3D
    track("test_start", { level: cur.level });
    stepTest(0);
  }
  function stepTest(dt) {
    const tt = cur && cur.test;
    if (!tt || tt.status !== "running") return;
    const p = cur.project, end = p.span + cur.design.vehicleLength();
    // follow real time (slow phones too) but check the bridge at least every 0.5 m of travel
    const target = Math.min(end, tt.x + end / TEST_SECONDS * Math.min(dt, 1));
    do {
      tt.x = Math.min(target, tt.x + 0.5);
      let r;
      try { r = cur.design.solveAt(tt.x); }
      catch (e) {
        if (!(e instanceof UnstableStructure)) throw e;
        tt.status = "failed"; tt.result = null;
        return finishTest(false, t("Collapsed: the frame can wobble freely. Every road joint must be held up and every joint needs two members that are not in one line."));
      }
      tt.result = r; tt.worst = Math.max(tt.worst, r.maxRatio);
      if (r.failed) { tt.status = "failed"; tt.failIdx = r.worst; return finishTest(false, r.members[r.worst].explanation); }
    } while (tt.x < target);
    if (tt.x >= end) { tt.status = "passed"; finishTest(true); }
  }
  function finishTest(ok, why) {
    const p = cur.project, lvl = cur.level, used = cur.design.partsUsed(), worstPct = (cur.test.worst * 100).toFixed(0);
    if (ok && cur.weekly) {
      const better = S.weekly.best === null || used < S.weekly.best;
      if (better) S.weekly.best = used;
      S.vehicles++; sfx.pass(); track("level_complete", { level: "weekly", parts: used });
      setMsg(t("Challenge passed with {u} parts! Your best this week: {b} parts.", { u: used, b: S.weekly.best }), "good");
      modal("🏆 " + esc(t("Weekly challenge")), `<p>${esc(t("Challenge passed with {u} parts! Your best this week: {b} parts.", { u: used, b: S.weekly.best }))}</p>` +
        (better ? `<p><b>${t("New personal best!")}</b></p>` : ""), [[t("Back to the road"), () => { closeModal(); show("world"); }], [t("Keep improving"), closeModal]]);
    } else if (ok) {
      S.complete[lvl] = true; S.vehicles++;
      S.bestParts[lvl] = Math.min(S.bestParts[lvl] ?? Infinity, used);
      const st = starsOf(lvl);
      sfx.pass(); track("level_complete", { level: lvl, stars: st });
      setMsg(t("Bridge passed! The {v} crossed. Highest load {n}% of breaking.", { v: t(p.vehicle.name), n: worstPct }), "good");
      const nextLv = LV[idxOf(lvl) + 1];
      const toOpen = nextLv && openShare(nextLv.l) < 1
        ? t("Answer questions here: at {h}% the next class opens halfway, at 100% fully. Now {c}%.", { h: pct(HALF_AT), c: pct(coverage(lvl)) }) : "";
      modal(t("🎉 Bridge passed!"), `<p style="font-size:30px;text-align:center;margin:4px" class="stars">${starText(st)}</p>
        <p>${t("The {v} crossed safely. The most loaded member reached <b>{n}%</b> of its limit.", { v: esc(t(p.vehicle.name)), n: worstPct })}</p>
        <ul><li>★ ${t("Bridge holds")}</li><li>${used <= p.par_parts ? "★" : "☆"} ${t("Built within par: {u} / {p} parts", { u: used, p: p.par_parts })}</li>
        <li>${(S.bridgeCorrect[lvl] || 0) >= BRIDGE_STAR_GOAL ? "★" : "☆"} ${t("Bridge quiz: {a} / {b} right", { a: S.bridgeCorrect[lvl] || 0, b: BRIDGE_STAR_GOAL })}</li></ul>
        ${toOpen ? `<p>📚 ${esc(toOpen)}</p>` : ""}`,
        [[t("Back to the road"), () => { closeModal(); show("world"); world.focus(lvl); }], [t("Keep improving"), closeModal]]);
    } else {
      sfx.snap(); track("game_over", { level: lvl });
      const n = nextGuided(), member = cur.test.failIdx !== undefined;
      setMsg(t("{why} Strengthen the dark red member (bigger size, stronger material) or add bracing.", { why }), "bad");
      after3d(() => modal(t("💥 The bridge failed"), `<p><b>${esc(why)}</b></p><p>${t(member ? "The broken member is dark red. Hover or tap any member to read its force."
        : "Nothing broke - the frame could move like a mechanism, so it needs more members.")}</p><p>${esc(t(p.hints[0]))}</p>`,
        [[t("Second chance: show the next guided member"), () => { closeModal(); track("reward_offered", { kind: "fix" });
          offerReward(() => { track("reward_taken", { kind: "fix" }); cur.guide = true; $("btn-guide").classList.add("on"); setMsg(n ? guideLine() : t("Your design is complete - make the red member bigger.")); }); }],
         [t("Try again"), closeModal]]));
    }
    checkBadges(); save(); hud(); renderClassbar(); buildMinimap();
  }

  function memberColour(k, m) {
    const tt = cur.test;
    if (tt && tt.result) {
      const r = tt.result.members[k];
      if (r.slack) return "#64748b";
      if (r.status === FAILED) return "#7f1d1d";
      return r.status === RED ? "#ef4444" : r.status === YELLOW ? "#facc15" : "#22c55e";
    }
    const c = CAT.materials[m[2]].colour; return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function arrow(x0, y0, x1, y1, col, label) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    bx.strokeStyle = col; bx.fillStyle = col; bx.lineWidth = 3;
    bx.beginPath(); bx.moveTo(x0, y0); bx.lineTo(x1, y1); bx.stroke();
    bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4));
    bx.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4)); bx.fill();
    bx.font = "bold 12px Segoe UI, system-ui"; bx.textAlign = "center";
    bx.fillStyle = "rgba(15,23,42,.85)"; const w = bx.measureText(label).width + 8;
    bx.fillRect(x1 + 14 * Math.cos(a) - w / 2, y1 + 14 * Math.sin(a) - 9, w, 16);
    bx.fillStyle = col; bx.fillText(label, x1 + 14 * Math.cos(a), y1 + 14 * Math.sin(a) + 3);
  }
  function drawForces() {
    if (!cur.forces || cur.fj === null || !cur.fr) return;
    const p = cur.project, j = cur.fj, [jx, jy] = px(...p.joints[j]), all = cur.design.all();
    const at = all.map((m, k) => [m, k]).filter(([m]) => m[0] === j || m[1] === j);
    const maxN = Math.max(1, ...at.map(([, k]) => Math.abs(cur.fr.members[k].N)));
    for (const [m, k] of at) {
      const N = cur.fr.members[k].N, other = m[0] === j ? m[1] : m[0];
      if (Math.abs(N) < 1) continue;
      const [ox, oy] = px(...p.joints[other]), L = Math.hypot(ox - jx, oy - jy) || 1, ux = (ox - jx) / L, uy = (oy - jy) / L;
      const len = 18 + 52 * Math.abs(N) / maxN;
      // tension pulls the joint towards the member; compression pushes it away
      if (N > 0) arrow(jx, jy, jx + ux * len, jy + uy * len, "#38bdf8", `${(N / 1000).toFixed(1)} kN`);
      else arrow(jx + ux * len, jy + uy * len, jx, jy, "#f87171", `${(-N / 1000).toFixed(1)} kN`);
    }
    bx.strokeStyle = "#facc15"; bx.lineWidth = 2; bx.beginPath(); bx.arc(jx, jy, 11, 0, 7); bx.stroke();
  }
  const SIZE_W = { S: 2, M: 3, L: 4, XL: 6 };
  function drawBuild(now) {
    if (!cur || !BW) return;
    const p = cur.project, d = cur.design, v = viewXf();
    bx.fillStyle = "#0b1120"; bx.fillRect(0, 0, BW, BH);
    const [bankL] = px(0, 0), [bankR] = px(p.span, 0), deckY = v.oy;
    bx.fillStyle = "#0c4a6e"; bx.fillRect(bankL, deckY + 6, bankR - bankL, BH - deckY);
    bx.fillStyle = "#3f3124"; bx.fillRect(0, deckY, bankL, BH - deckY); bx.fillRect(bankR, deckY, BW - bankR, BH - deckY);
    bx.fillStyle = "#65a30d"; bx.fillRect(0, deckY - 1, bankL, 3); bx.fillRect(bankR, deckY - 1, BW - bankR, 3);
    const hoverM = cur.mouse && !cur.forces ? memberAt(cur.mouse[0], cur.mouse[1], false) : null;
    d.all().forEach((m, k) => {
      const [x1, y1] = px(...p.joints[m[0]]), [x2, y2] = px(...p.joints[m[1]]);
      bx.strokeStyle = memberColour(k, m);
      bx.lineWidth = m[4] === "pylon" ? 8 : SIZE_W[m[3]] + (m[4] === "deck" ? 1 : 0);
      if (cur.test && cur.test.failIdx === k && cur.test.status === "failed") bx.lineWidth += 3;
      bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
      if (k === hoverM) { bx.strokeStyle = "#fff"; bx.lineWidth = 1; bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke(); }
    });
    const n = cur.guide && nextGuided();
    if (n && !busy()) {
      const [x1, y1] = px(...p.joints[n.m[0]]), [x2, y2] = px(...p.joints[n.m[1]]), pulse = 6 + 4 * Math.sin(now / 180);
      bx.setLineDash([6, 6]); bx.strokeStyle = "rgba(250,204,21,.8)"; bx.lineWidth = 2;
      bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke(); bx.setLineDash([]);
      for (const [x, y] of [[x1, y1], [x2, y2]]) { bx.fillStyle = "rgba(250,204,21,.35)"; bx.beginPath(); bx.arc(x, y, 8 + pulse, 0, 7); bx.fill(); }
    }
    if (cur.sel !== null && cur.mouse) {
      const [x, y] = px(...p.joints[cur.sel]);
      bx.strokeStyle = "#facc15"; bx.lineWidth = 1; bx.beginPath(); bx.moveTo(x, y); bx.lineTo(...cur.mouse); bx.stroke();
    }
    p.joints.forEach((j, k) => {
      const [x, y] = px(j[0], j[1]), sup = p.supports[String(k)];
      if (sup) {
        bx.fillStyle = "#94a3b8"; bx.beginPath(); bx.moveTo(x, y + 4); bx.lineTo(x - 9, y + 16); bx.lineTo(x + 9, y + 16); bx.fill();
        if (sup === "roller") { bx.beginPath(); bx.arc(x - 5, y + 19, 3, 0, 7); bx.arc(x + 5, y + 19, 3, 0, 7); bx.fill(); }
      }
      bx.fillStyle = k === cur.sel ? "#facc15" : "#f1f5f9"; bx.beginPath(); bx.arc(x, y, k === cur.sel ? 8 : 6, 0, 7); bx.fill();
      bx.strokeStyle = "#0f172a"; bx.lineWidth = 1; bx.stroke();
    });
    const tt = cur.test;
    const vx = tt ? tt.x : (cur.forces && cur.fr ? p.span / 2 + d.vehicleLength() / 2 : null);
    if (vx !== null) {
      const veh = p.vehicle, col = `rgb(${veh.colour.join(",")})`;
      for (const off of veh.axles) {
        const ax = vx - off;
        if (ax < 0 || ax > p.span) continue;
        const [x, y] = px(ax, 0);
        bx.fillStyle = col; bx.fillRect(x - 10, y - 16, 20, 12);
        bx.fillStyle = "#1e293b"; bx.beginPath(); bx.arc(x - 5, y - 3, 3, 0, 7); bx.arc(x + 5, y - 3, 3, 0, 7); bx.fill();
      }
    }
    drawForces();
    if (hoverM !== null && !busy()) {
      const m = d.all()[hoverM];
      let txt = `${matName(m[2])} ${m[4] === "pylon" ? t("pylon") : m[3]}, ${d.length(m[0], m[1]).toFixed(1)} m`;
      if (tt && tt.result) txt += ": " + tt.result.members[hoverM].explanation;
      bx.fillStyle = "rgba(15,23,42,.9)"; bx.font = "12.5px Segoe UI, system-ui";
      const w = Math.min(BW - 16, bx.measureText(txt).width + 14);
      bx.fillRect(8, BH - 30, w, 22); bx.fillStyle = "#e2e8f0"; bx.textAlign = "left"; bx.fillText(txt, 15, BH - 15, BW - 30);
    }
  }

  // ---------------- modals ----------------
  let modalKeys = null;
  function modal(title, html, buttons = []) {
    $("m-title").innerHTML = title; $("m-body").innerHTML = html;
    const f = $("m-foot"); f.innerHTML = "";
    buttons.forEach(([label, fn, cls]) => { const b = document.createElement("button"); b.innerHTML = label; b.onclick = fn; b.className = cls === undefined ? "primary" : cls; f.appendChild(b); });
    f.style.display = buttons.length ? "flex" : "none";
    $("modal").classList.add("show");
  }
  function closeModal() { $("modal").classList.remove("show"); $("modal").classList.remove("report"); modalKeys = null; }
  $("m-close").onclick = closeModal;
  $("modal").addEventListener("pointerdown", e => { if (e.target === $("modal")) closeModal(); });

  function openBank() {
    if (!cur || cur.weekly || !cur.pool) return;
    const per = 5; let page = 0;
    const pages = () => Math.max(1, Math.ceil(cur.pool.length / per));
    const draw = () => {
      const items = cur.pool.slice(page * per, page * per + per);
      $("m-body").innerHTML = items.map((q, k) => { const v = shown(q); return `<div class="bankitem"><div class="bq">${page * per + k + 1}. ${SYM ? (SUBJ_ICON[q.s] || "") : `[${esc(sname(q.s))}]`} ${esc(v.q)}</div>
        <ol type="A">${v.o.map((o, i) => `<li data-i="${i}" data-a="${q.a}">${esc(o)}</li>`).join("")}</ol>
        <div class="be" hidden>${SYM ? `✔ ${esc(v.o[q.a])}` : esc(t("Answer: {a}", { a: v.o[q.a] }))} · ${esc(v.e)}</div></div>`; }).join("");
      // answers stay hidden until an option is tapped: right = green, a wrong pick = red, then the explanation
      $("m-body").querySelectorAll(".bankitem li").forEach(li => li.onclick = () => {
        const item = li.closest(".bankitem"); if (item.classList.contains("done")) return;
        item.classList.add("done");
        item.querySelectorAll("li").forEach(x => { if (x.dataset.i === x.dataset.a) x.classList.add("right"); });
        if (li.dataset.i !== li.dataset.a) li.classList.add("wrong");
        item.querySelector(".be").hidden = false;
      });
      $("pg").textContent = SYM ? `${(page + 1).toLocaleString("en-IN")} / ${pages().toLocaleString("en-IN")}`
        : t("Page {a} of {b}", { a: (page + 1).toLocaleString("en-IN"), b: pages().toLocaleString("en-IN") });
      $("m-body").scrollTop = 0;
    };
    const go = d => { page = Math.max(0, Math.min(pages() - 1, page + d)); draw(); };
    const subj = cur.subject ? sname(cur.subject) : t("All subjects");
    const bankTitle = SYM ? `📋 ${esc(classSym(cur.info))} · ${cur.subject ? (SUBJ_ICON[cur.subject] || esc(subj)) : "✳️"} · ${cur.pool.length.toLocaleString("en-IN")}`
      : esc(t("📋 Q&A Bank: {a} - {b} ({n})", { a: lname(cur.info), b: subj, n: cur.pool.length.toLocaleString("en-IN") }));
    modal(bankTitle, "", [
      ["⏮", () => go(-1e9), ""], [SYM ? "◀" : t("◀ Prev"), () => go(-1)], [`<span id="pg"></span>`, () => {}, ""], [SYM ? "▶" : t("Next ▶"), () => go(1)], ["⏭", () => go(1e9), ""]]);
    draw();
    modalKeys = e => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "PageDown") go(50); else if (e.key === "PageUp") go(-50); };
  }

  function openGuide() {
    cur.guide = !cur.guide; $("btn-guide").classList.toggle("on", cur.guide);
    if (!cur.guide) { setMsg(""); return; }
    const n = nextGuided(), nowStep = n ? cur.project.steps.indexOf(n.step) : cur.project.steps.length;
    if (SYM) {
      const items = cur.project.steps.map((st, k) => {
        const mark = k < nowStep ? "✓" : k === nowStep ? "▶" : "·";
        const sizes = [...new Set(st.members.map(m => m[3]))].join("/");
        return `<li class="${k < nowStep ? "done" : k === nowStep ? "now" : ""}">${mark} ${MAT_ICON[st.members[0][2]] || ""} × ${st.members.length} · ${sizes}</li>`;
      }).join("");
      modal(`🧭 ${Math.min(nowStep + 1, cur.project.steps.length)}/${cur.project.steps.length}`, `<ol class="steps">${items}</ol>`,
        [["▶", () => { closeModal(); renderInfo(); }]]);
      renderInfo();
      return;
    }
    const steps = cur.project.steps.map((s, k) => `<li class="${k < nowStep ? "done" : k === nowStep ? "now" : ""}">${esc(t(s.text))}
      <small>(${s.members.length} × ${esc(matName(s.members[0][2]))}${[...new Set(s.members.map(m => m[3]))].map(x => " " + x).join("/")})</small></li>`).join("");
    modal(esc(t("🧭 Guided build: {p}", { p: t(cur.project.name) })), `<p>${esc(t(cur.project.goal))}</p><ol class="steps">${steps}</ol>
      <p>${esc(t("On the bridge, the glowing joints show the next member. Tap them, or press ▶ Show me to place it with your parts. Stuck? 💡 Hint gives three hints in turn."))}</p>
      <p><small>${esc(t(cur.project.tip))}</small></p>`, [[t("Start building"), () => { closeModal(); renderInfo(); }]]);
    renderInfo();
  }

  async function openHandbook() {
    if (!HANDBOOK) { modal(SYM ? "📘" : t("📘 Engineering Handbook"), "<p>⏳</p>"); HANDBOOK = await (await fetch("data/handbook.json")).json(); }
    let sec = 0, query = "";
    const draw = () => {
      const bn = getLang() === "bn";
      const tabs = HANDBOOK.map((s, k) => `<button class="${k === sec && !query ? "on" : ""}" data-s="${k}" title="${esc(bn ? s.title_bn : s.title)}">${SYM ? k + 1 : esc(bn ? s.title_bn : s.title)}</button>`).join(" ");
      const rows = [];
      HANDBOOK.forEach((s, k) => s.items.forEach((it, i) => {
        const hit = query ? (it[0] + it[1] + it[2] + it[3]).toLowerCase().includes(query) : k === sec;
        if (hit) rows.push(`<details><summary>Q${s.first + i}. ${esc(bn ? it[2] : it[0])}</summary><p>${esc(bn ? it[3] : it[1])}</p></details>`);
      }));
      $("m-body").innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${tabs}</div>` +
        (SYM ? "" : `<p><small>${esc(t("200 answers from the classic FAILSPAN levels: the physics of trusses, beams, wind, quakes and money."))}</small></p>`) +
        (rows.join("") || `<p>${SYM ? "∅" : t("No matches.")}</p>`);
      $("m-body").querySelectorAll("button[data-s]").forEach(b => b.onclick = () => { sec = +b.dataset.s; query = ""; $("hb-q").value = ""; draw(); });
    };
    modal(SYM ? "📘" : t("📘 Engineering Handbook"), "", [[`<input type="search" id="hb-q" placeholder="${SYM ? "🔍" : esc(t("Search both languages…"))}">`, () => {}, ""]]);
    $("hb-q").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  function openProfile() {
    const done = nDone(S), stars = LV.reduce((a, l) => a + starsOf(l.l), 0);
    const badges = BADGES.map(([k, ic, name]) => `<div class="badge ${S.badges[k] ? "got" : ""}" title="${esc(t(name))}"><span class="ic">${S.badges[k] ? ic : "🔒"}</span>${SYM ? "" : esc(t(name))}</div>`).join("");
    const startSel = LV.map((l, k) => `<option value="${k}" ${k === S.start ? "selected" : ""}>${esc(classSym(l))}</option>`).join("");
    if (SYM) {
      const x = [[16, "Expert Engineer"], [10, "Chief Engineer"], [5, "Site Engineer"], [1, "Junior Engineer"]].find(([n]) => nDone(S) >= n);
      modal(`🏅 ${RANK_ICON[x ? x[1] : "Trainee"]}`,
        `<p style="font-size:1.15em">🌉 ${done}/16 · ⭐ ${stars}/48 · ✔ ${totalCorrect(S).toLocaleString("en-IN")} · 🏆 ${S.best} · 🔥 ${S.streak}</p>` +
        `<div class="badges">${badges}</div><p style="margin-top:14px">🏫 <select id="pf-start" style="font:inherit;padding:6px;border-radius:6px">${startSel}</select></p>`,
        [["📄", openReport], ["✔", closeModal]]);
      $("pf-start").onchange = e => { S.start = +e.target.value; save(); buildMinimap(); toast("🏫 ✔"); };
      return;
    }
    modal(`🏅 ${esc(title())}`, `<p>${esc(t("{a} of 16 bridges built · {b} of 48 stars · {c} right answers · best score {d} · 🔥 {e}-day streak",
        { a: done, b: stars, c: totalCorrect(S).toLocaleString("en-IN"), d: S.best, e: S.streak }))}</p><div class="badges">${badges}</div>
      <p style="margin-top:14px">${t("My class:")} <select id="pf-start" style="font:inherit;padding:6px;border-radius:6px">${startSel}</select>
      <small> ${t("- buildings up to your class are open.")}</small></p>
      <p><small>${esc(t("Answer {a}% of a class's questions right and the next class opens halfway; 100% opens it fully. Locked buildings let you try {n} questions every {h} hours.",
        { a: pct(HALF_AT), n: PREVIEW_QS, h: PREVIEW_HOURS }))}</small></p>`, [[t("📄 Report card"), openReport], [t("Done"), closeModal]]);
    $("pf-start").onchange = e => { S.start = +e.target.value; save(); buildMinimap(); toast(t("Class saved")); };
  }

  // ---------------- report card (for teachers and parents) ----------------
  function reportRows() {
    return LV.map(l => ({ name: lname(l), stars: starsOf(l.l), bridge: S.complete[l.l] ? t("built") : t("not yet"),
      right: S.correct[l.l] || 0, mastery: `${pct(coverage(l.l))}%`, quiz: S.bridgeCorrect[l.l] || 0,
      parts: S.bestParts[l.l] ?? "-" }));
  }
  function openReport() {
    const rows = reportRows(), date = new Date().toLocaleDateString(getLang() === "bn" ? "bn-IN" : "en-IN");
    const head = [t("Building"), t("Stars"), t("Bridge"), t("Right answers"), t("Covered"), t("Bridge quiz"), t("Best parts")];
    const html = `<p><b>${t("Title")}:</b> ${esc(title())} · <b>${t("Streak")}:</b> ${S.streak} · <b>${t("Total right answers")}:</b> ${totalCorrect(S)} ·
      <b>${t("Bridges built")}:</b> ${nDone(S)}/16 · <b>${t("Score")}:</b> ${S.score}</p>
      <table class="report"><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr>${rows.map(r => `<tr><td>${esc(r.name)}</td><td class="stars">${starText(r.stars)}</td>
      <td>${r.bridge}</td><td>${r.right}</td><td>${r.mastery}</td><td>${r.quiz}/${BRIDGE_STAR_GOAL}</td><td>${r.parts}</td></tr>`).join("")}</table>`;
    modal(esc(t("📄 Report card - {d}", { d: date })), html, [[t("🖨 Print / Save PDF"), () => window.print()], [t("📋 Copy text"), () => {
      const txt = [`FAILSPAN - ${date}`, `${t("Title")}: ${title()} | ${t("Streak")}: ${S.streak} | ${t("Total right answers")}: ${totalCorrect(S)} | ${t("Bridges built")}: ${nDone(S)}/16`,
        head.join("\t")].concat(rows.map(r => [r.name, starText(r.stars), r.bridge, r.right, r.mastery, `${r.quiz}/${BRIDGE_STAR_GOAL}`, r.parts].join("\t"))).join("\n");
      try { navigator.clipboard.writeText(txt).then(() => toast(t("Copied")), () => {}); } catch (e) {}
    }]]);
    $("modal").classList.add("report");
  }

  // ---------------- buttons, keys, loop ----------------
  $("btn-back").onclick = () => { save(); show("world"); if (!cur.weekly) world.focus(cur.level); };
  $("btn-bank").onclick = openBank;
  $("btn-guide").onclick = openGuide;
  $("btn-handbook").onclick = openHandbook;
  $("btn-profile").onclick = openProfile;
  $("btn-mute").onclick = () => { S.muted = !S.muted; if (S.muted) stopSpeech(); save(); hud(); };
  $("btn-view").onclick = () => setView3d(!S.view3d);
  $("btn-3d").onclick = () => show3d(!v3.shown);
  $("btn-lang").onclick = () => { S.lang = S.lang === "bn" ? "en" : "bn"; save(); applyLang(); };
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if ($("modal").classList.contains("show")) { if (e.key === "Escape") closeModal(); else if (modalKeys) modalKeys(e); return; }
    if (view === "world") {
      if (e.key === "ArrowRight") { world.cam += 300; world.clamp(); } else if (e.key === "ArrowLeft") { world.cam -= 300; world.clamp(); }
      return;
    }
    if (view !== "class" || !cur) return;
    if (["1", "2", "3", "4"].includes(e.key)) answer(+e.key - 1);
    else if (e.key === " " || e.key === "Enter") { if (!cur.weekly) { e.preventDefault(); nextQ(); } }
    else if (e.key === "q" || e.key === "Q") openBank();
    else if ((e.key === "t" || e.key === "T") && !cur.preview) startTest();
    else if (e.key === "u" || e.key === "U") undo();
    else if (e.key === "Escape") { if (cur.sel !== null) cur.sel = null; else { save(); show("world"); } }
  });
  window.addEventListener("resize", () => { hud(); if (view === "world") resizeWorld(); if (view === "class") resizeBuild(); });
  // the canvases change size when the question card or chips change, not only on window resize
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => { if (view === "class") resizeBuild(); }).observe(bc);
    new ResizeObserver(() => { if (view === "world") resizeWorld(); }).observe(wc);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1, (now - last) / 1000); last = now;
    // weak phone: switch off decorations instead of dropping frames
    world.frameMs.push(dt * 1000); if (world.frameMs.length > 120) world.frameMs.shift();
    if (!world.lowFx && world.frameMs.length === 120 && world.frameMs.reduce((a, b) => a + b) / 120 > 34) world.lowFx = true;
    if (view === "world") {
      if (v3.wshown && v3.world) { $("world3d").style.height = wc.clientHeight + "px"; v3.world.render(now, wsnap3d()); } else drawWorld(now);
    } else if (view === "class") {
      stepTest(dt); drawBuild(now);
      if (v3.shown && v3.view && cur) { v3.view.render(now, snap3d()); hud3d(); }
    }
    requestAnimationFrame(frame);
  }

  async function boot() {
    S = load();
    const [lv, cat] = await Promise.all([fetch("data/levels.json").then(r => r.json()), fetch("data/projects.json").then(r => r.json())]);
    LV = lv.levels; NAMES = lv.subject_names; CAT = cat;
    world.layout();
    $("loading").remove(); $("app").hidden = false;
    applyLang();
    document.body.classList.toggle("mode3d", !!S.view3d);
    if (S.view3d) load3d().catch(() => {});
    // opening theme: dominoes from Class 1 down to Expert Engineer, each smaller, then the game starts
    window.BWIntro.play({
      labels: LV.map(lname), title: t("FAILSPAN"), subtitle: t("Small steps. Bigger every class."),
      tagline: t("STRUCTURAL MAYHEM"), stressLabel: t("STRESS COEFFICIENT"), skipText: t("Skip ▶"),
      click: (k, n) => tone(880 - k * 42, 0.06 + k * 0.006, "square", 0.03 + 0.06 * k / n),
      freezeAt: new URLSearchParams(location.search).has("introAt") ? +new URLSearchParams(location.search).get("introAt") : null,
      onDone: () => {
        if (S.start < 0) show("start"); else { show("world"); world.focus(LV[unlockedUpTo()].l); }
        requestAnimationFrame(frame);
      },
    });
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  boot().catch(e => { $("loading").textContent = "Could not load the game data. Please reload."; console.error(e); });
})();
