// Checks the unlock rules (js/unlock.js, owner rules 28-Nov-2026) with simulated saved progress and the real
// class list (data/levels.json) and question files (data/q).
const fs = require("fs"), path = require("path");
const U = require("../js/unlock.js");
const LV = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/levels.json"), "utf8")).levels;
let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
const idx = name => LV.findIndex(l => l.name === name);
const st = (s, name) => U.state(LV, s, idx(name));
// the class's questions in row order, empty rows left out, exactly as the game loads them
const questions = level => JSON.parse(fs.readFileSync(path.join(__dirname, `../data/q/${level}.json`), "utf8")).q
  .map((row, i) => row && { i, q: row[1] }).filter(Boolean);
const player = (start, doneN = {}) => { const s = { start, doneN, unlock: null }; U.migrate(LV, s, false); return s; };
const doneOf = (name, n) => ({ [LV[idx(name)].l]: n });

check(LV.map(l => l.name).join(" > ") === "Class 8 > Class 9 > Class 10 > Class 11 > Class 12 > BE > NIT > IIT > Expert Engineer",
  "class order: " + LV.map(l => l.name).join(" > "));

// new player starting at Class 8
let s = player(idx("Class 8"));
check(st(s, "Class 8").full, "start Class 8: Class 8 fully open");
check(LV.slice(1).every(l => U.state(LV, s, idx(l.name)).count === 10 && !U.state(LV, s, idx(l.name)).full),
  "start Class 8: every class above shows a 10-question demo");

// new player starting at Class 10
s = player(idx("Class 10"));
check(st(s, "Class 8").locked && st(s, "Class 9").locked, "start Class 10: Class 8 and 9 locked");
check(st(s, "Class 8").count === 0 && U.pool(questions(8), st(s, "Class 8")).length === 0, "start Class 10: no demo in Class 8");
check(st(s, "Class 10").full, "start Class 10: Class 10 fully open");
const q11 = questions(11), demo = U.pool(q11, st(s, "Class 11"));
check(demo.length === 10 && demo.every((q, j) => q === q11[j]), "start Class 10: Class 11 demo = its first 10 questions in row order");
const raw11 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/q/11.json"), "utf8")).q;
check(demo.every(q => raw11[q.i]) && demo[9].i >= 9, `Class 11 demo skips empty rows (rows ${demo.map(q => q.i).join(",")})`);
// locked for good: answering everywhere never opens a class below the start
s.doneN = Object.fromEntries(LV.map(l => [l.l, 5000])); U.update(LV, s);
check(st(s, "Class 8").locked && st(s, "Class 9").locked, "start Class 10: Class 8 and 9 stay locked whatever is answered");

// previous class answered right: 0, 9, 10, 99, 100 (Class 10 start, Class 11 counted from Class 10)
for (const [n, want] of [[0, 10], [9, 10], [10, 20], [19, 20], [55, 60], [99, 100], [100, "all"]]) {
  const p = player(idx("Class 10"), doneOf("Class 10", n)), o = st(p, "Class 11");
  check(want === "all" ? o.full && U.pool(q11, o).length === q11.length : !o.full && o.count === want && U.pool(q11, o).length === want,
    `Class 10 has ${n} right -> Class 11 opens ${want}`);
}
// and the class after that counts the right answers of its own previous class
s = player(idx("Class 10"), Object.assign(doneOf("Class 10", 100), doneOf("Class 11", 30)));
check(st(s, "Class 11").full && st(s, "Class 12").count === 40 && st(s, "BE").count === 10, "Class 10: 100 -> 11 full; Class 11: 30 -> 12 opens 40; BE demo 10");
s = player(idx("Class 12"), doneOf("Class 12", 100));
check(st(s, "BE").full && st(s, "NIT").count === 10, "previous of BE is Class 12 (100 right -> BE full)");
s = player(idx("BE"), doneOf("BE", 20));
check(st(s, "NIT").count === 30, "previous of NIT is BE (20 right -> NIT 30)");
s = player(idx("NIT"), doneOf("NIT", 40));
check(st(s, "IIT").count === 50, "previous of IIT is NIT (40 right -> IIT 50)");
s = player(idx("IIT"), doneOf("IIT", 100));
check(st(s, "Expert Engineer").full, "previous of Expert Engineer is IIT (100 right -> Expert full)");

// wrong answers: the right-answer count does not move, so nothing opens
s = player(idx("Class 8"), doneOf("Class 8", 15));
const before = JSON.stringify(s.unlock);
check(!U.update(LV, s) && JSON.stringify(s.unlock) === before && st(s, "Class 9").count === 20, "wrong answers open nothing");

// open counts never go down
s = player(idx("Class 8"));
let last = LV.map(() => 0), down = 0;
for (let step = 0; step < 400; step++) {
  const L = LV[Math.floor(Math.random() * LV.length)].l;
  s.doneN[L] = Math.max(0, (s.doneN[L] || 0) + Math.floor(Math.random() * 15) - 5);   // even if a count ever dropped
  U.update(LV, s);
  const now = LV.map((l, k) => U.state(LV, s, k).full ? Infinity : U.state(LV, s, k).count);
  now.forEach((c, k) => { if (c < last[k]) down++; }); last = now;
}
check(down === 0, "open counts never go down (400 random steps)");
s = player(idx("Class 8"), doneOf("Class 8", 100)); s.doneN = {};
check(st(s, "Class 9").full, "a fully open class stays fully open");
s = player(idx("Class 8"), doneOf("Class 8", 40)); s.doneN = {};
check(st(s, "Class 9").count === 50, "a saved count of 50 stays 50");

// existing Class 12 player from before (old rule: classes up to theirs fully open, 50% of the previous class
// answered right -> every second question open, 100% -> fully open)
const old = { start: idx("Class 12"), score: 1234, best: 1500, builds: { 8: [[0, 1, "Steel", 1]] }, badges: { bridge1: true },
  correct: { 8: 70 }, done: { 8: "AQ==" }, doneN: Object.assign(doneOf("Class 8", 70), doneOf("Class 12", Math.ceil(LV[idx("Class 12")].n / 2)),
  doneOf("BE", LV[idx("BE")].n)), complete: { 8: true }, unlock: undefined };
const keep = JSON.stringify(Object.assign({}, old, { unlock: undefined }));
check(U.migrate(LV, old, true), "existing player: migrated once");
check(["Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].every(n => st(old, n).full), "existing Class 12 player: Classes 8 to 12 stay fully open");
check(st(old, "BE").full, "existing player: BE was half open; Class 12 has over 100 right, so the new rule opens it fully");
const qBE = questions(15), poolBE = U.pool(qBE, st(old, "BE"));
check(qBE.filter(q => q.i % 2 === 0).every(q => poolBE.includes(q)), "existing player: every question that was visible in BE is still there");
check(st(old, "NIT").full, "existing player: NIT was fully open (BE 100% answered) and stays fully open");
check(LV.every((l, k) => !U.state(LV, old, k).locked), "existing player: nothing gets locked");
check(JSON.stringify(Object.assign({}, old, { unlock: undefined })) === keep, "existing player: answered counts, score, builds and badges unchanged");
check(!U.migrate(LV, old, true), "migration runs only once (version flag)");
// a half-open class where the new rule gives less (small made-up bank: previous class 150 questions, 80 right)
const SM = [{ l: 1, n: 150 }, { l: 2, n: 150 }, { l: 3, n: 150 }];
const sm = { start: 0, doneN: { 1: 80 }, unlock: null }; U.migrate(SM, sm, true);
const q2 = Array.from({ length: 150 }, (_, i) => ({ i })), o2 = U.state(SM, sm, 1), p2 = U.pool(q2, o2);
check(o2.half && !o2.full && o2.count === 90, "half open before, 80 right now: still half open, plus the first 90 (10 + 80)");
check(q2.filter(q => q.i % 2 === 0).every(q => p2.includes(q)) && p2.length === 90 + 30, `...keeps all 75 questions it showed before (now ${p2.length} open)`);
check(U.state(SM, sm, 2).count === 10 && !U.state(SM, sm, 2).locked, "...and the class after it gets its 10-question demo");
// a player who once opened the game but never picked a class is treated as new
s = { start: -1, doneN: {}, unlock: null }; U.migrate(LV, s, true);
check(Object.keys(s.unlock.full).length === 0 && Object.keys(s.unlock.open).length === 0, "saved data without a chosen class: nothing kept open, nothing saved yet");
s.start = idx("Class 10"); U.update(LV, s);
check(st(s, "Class 8").locked && st(s, "Class 10").full && st(s, "Class 11").count === 10, "...then picking Class 10 follows the new rules");

// ---- a REAL old-format save: tests/old-save-class12.json was generated by running commit cd30c14 (before the
// unlock rules) as a Class 12 player; it has no unlock field. It goes through the same steps as the game's boot():
// game.js load() (its fresh() and 08-Nov migrate(), taken from js/game.js itself), then U.migrate(LV, S, true).
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, "old-save-class12.json"), "utf8")).save;
const gameSrc = fs.readFileSync(path.join(__dirname, "../js/game.js"), "utf8");
const from = gameSrc.indexOf("  function fresh()"), to = gameSrc.indexOf("  let hadSave");
check(from >= 0 && to > from, "js/game.js: fresh() and the 08-Nov migrate() found");
const G = new Function(gameSrc.slice(from, to) + "\nreturn { fresh, migrate };")();
const bootLoad = raw => { const S = G.migrate(Object.assign(G.fresh(), JSON.parse(JSON.stringify(raw)))); U.migrate(LV, S, true) || U.update(LV, S); return S; };
const KEPT = ["score", "best", "treasury", "answered", "correct", "done", "doneN", "badges", "builds", "streak"];
check(!("unlock" in FIX) && FIX.start === idx("Class 12") && FIX.doneN[12] === 12, "real old save: Class 12, no unlock field, 12 right in Class 12");
const A = bootLoad(FIX);
// 1) what is open
check(["Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].every(n => st(A, n).full), "real old save: Classes 8, 9, 10, 11 and 12 fully open");
check(!st(A, "BE").full && st(A, "BE").count === 20, "real old save: BE 20 questions (10 + 10 for 12 right in Class 12)");
check(["NIT", "IIT", "Expert Engineer"].every(n => !st(A, n).full && !st(A, n).locked && st(A, n).count === 10), "real old save: NIT, IIT and Expert 10 each");
// 2) nothing else in the save changes
for (const k of KEPT) check(JSON.stringify(A[k]) === JSON.stringify(FIX[k]), `real old save: ${k} unchanged`);
// 3) the migration flag is set, and migrating again changes nothing
check(A.unlock && A.unlock.v === U.VERSION, "real old save: migration flag set (unlock.v = " + U.VERSION + ")");
const onceA = JSON.stringify(A);
check(!U.migrate(LV, A, true) && !U.update(LV, A) && JSON.stringify(A) === onceA, "real old save: a second migration changes nothing");
// 4) the same save as written before 08-Nov (no v8, start 11 while Classes 1-7 were still in the list) migrates the same
// way. The 08-Nov step also clears the builds of classes whose bridge project changed (11 and 12 here, both empty).
const pre = JSON.parse(JSON.stringify(FIX)); delete pre.v8; pre.start = 11;
const P = bootLoad(pre);
check(P.start === idx("Class 12") && JSON.stringify(P.unlock) === JSON.stringify(A.unlock), "pre-08-Nov copy: start 11 -> Class 12, same classes open as the real old save");
check(LV.every((l, k) => JSON.stringify(U.state(LV, P, k)) === JSON.stringify(U.state(LV, A, k))), "pre-08-Nov copy: every class in the same state");
check(KEPT.filter(k => k !== "builds").every(k => JSON.stringify(P[k]) === JSON.stringify(FIX[k])), "pre-08-Nov copy: score, best, treasury, answered counts, doneN, badges and streak unchanged");
// 5) NOT the same case: a brand-new player (no saved data) who picks Class 12 on the start screen, after the warning.
// Classes 8 to 11 locked for good is the INTENDED new-player rule; only players with an old save keep 8 to 12 open.
const N = Object.assign(G.fresh(), { v8: 1 }); U.migrate(LV, N, false) || U.update(LV, N);   // boot() with no save
N.start = idx("Class 12"); U.update(LV, N);                                                  // confirmStart(Class 12)
check(["Class 8", "Class 9", "Class 10", "Class 11"].every(n => st(N, n).locked) && st(N, "Class 12").full,
  "new player picks Class 12: Classes 8 to 11 locked (intended), Class 12 fully open");
check(["BE", "NIT", "IIT", "Expert Engineer"].every(n => st(N, n).count === 10 && !st(N, n).full), "new player picks Class 12: BE, NIT, IIT and Expert 10-question demos");

// ---- two tabs (or the installed app and a browser tab) never lower saved progress: game.js mergeSave() runs on
// every save. Each simulated tab loads like game.js load(), answers like answer() and saves like save(). The tab
// that was opened earlier never hears about the other tab here (worst case: no storage event at all).
const ga = gameSrc.indexOf("  function mergeSave("), gb = gameSrc.indexOf("  let base = null;");
check(ga >= 0 && gb > ga, "js/game.js: mergeSave() found");
const mergeSave = new Function(gameSrc.slice(ga, gb) + "\nreturn mergeSave;")();
const clone = o => JSON.parse(JSON.stringify(o));
function Tab(store) {
  const raw = store.v ? JSON.parse(store.v) : null, had = !!raw;
  const S = raw ? G.migrate(Object.assign(G.fresh(), raw)) : Object.assign(G.fresh(), { v8: 1 });
  let base = clone(S);
  U.migrate(LV, S, had) || U.update(LV, S);
  const tab = { S,
    save(own = null) {
      const st = store.v ? G.migrate(Object.assign(G.fresh(), JSON.parse(store.v))) : null;
      if (st) { mergeSave(S, st, base, own); U.update(LV, S); }
      store.v = JSON.stringify(S); base = clone(S);
    },
    pick(name) { S.start = idx(name); U.update(LV, S); tab.save(); },
    answer(level, row, right = true) {                // as answer(): right answers count once per question
      S.answered++;
      if (right) {
        S.score += 4; S.treasury += 10000; S.best = Math.max(S.best, S.score);
        S.parts[level] = (S.parts[level] || 0) + 8; S.correct[level] = (S.correct[level] || 0) + 1;
        const b = Uint8Array.from(atob(S.done[level] || ""), c => c.charCodeAt(0)), big = new Uint8Array(Math.max(b.length, (row >> 3) + 1)); big.set(b);
        if (!(big[row >> 3] & (1 << (row & 7)))) { big[row >> 3] |= 1 << (row & 7); S.done[level] = btoa(String.fromCharCode.apply(null, big)); S.doneN[level] = (S.doneN[level] || 0) + 1; }
      } else { S.score = Math.max(0, S.score - 1); S.treasury = Math.max(0, S.treasury - 1000); }
      U.update(LV, S); tab.save(level);
    } };
  return tab;
}
const progress = s => ({ doneN: s.doneN[12] || 0, answered: s.answered, correct: s.correct[12] || 0, best: s.best, BE: s.unlock.open[15] || 0 });
const notLower = (a, b) => Object.keys(a).every(k => b[k] >= a[k]);
const bitsOf = s => Uint8Array.from(atob(s.done[12] || ""), c => c.charCodeAt(0));
const hasAll = (big, small) => small.every((x, i) => (big[i] & x) === x);
for (const order of ["A then B", "B then A"]) {
  const store = { v: null }, first = Tab(store); first.pick("Class 12");
  const second = Tab(store);                                       // opened after the pick
  const [A, B] = order === "A then B" ? [second, first] : [first, second];   // "A then B": B was opened earlier
  for (let r = 0; r < 30; r++) A.answer(12, r);
  const afterA = JSON.parse(store.v);
  for (let r = 100; r < 105; r++) B.answer(12, r);
  const afterB = JSON.parse(store.v);
  check(notLower(progress(afterA), progress(afterB)) && hasAll(bitsOf(afterB), bitsOf(afterA)), `two tabs, ${order}: nothing of A's 30 right answers goes down when B saves 5`);
  check(afterB.doneN[12] === 35 && afterB.unlock.open[15] === 40, `two tabs, ${order}: both tabs' questions count (35 right, BE open 40)`);
  check(afterB.score === 140 && afterB.treasury === 50000000 + 350000 && afterB.parts[12] === 280, `two tabs, ${order}: score, treasury and parts = stored + each tab's change`);
}
{ // both tabs open a batch at the same moment
  const store = { v: null }, A = Tab(store); A.pick("Class 12"); const B = Tab(store);
  for (let r = 0; r < 9; r++) A.answer(12, r);
  for (let r = 50; r < 59; r++) B.answer(12, r);
  A.answer(12, 9); B.answer(12, 59);
  const s = JSON.parse(store.v);
  check(s.doneN[12] === 20 && s.unlock.open[15] === 30, "two tabs reach 10 right at the same time: 20 right, BE open 30 (10 + 20), nothing lost");
}
{ // the same question answered right in both tabs counts once
  const store = { v: null }, A = Tab(store); A.pick("Class 12"); const B = Tab(store);
  A.answer(12, 5); B.answer(12, 5);
  check(JSON.parse(store.v).doneN[12] === 1, "two tabs answer the same question right: it counts once");
}
{ // a wrong answer lowers score and treasury only by this tab's own change
  const store = { v: null }, A = Tab(store); A.pick("Class 12"); const B = Tab(store);
  for (let r = 0; r < 10; r++) A.answer(12, r);
  B.answer(12, 200); B.answer(12, 201, false);                    // the other tab: +4 then -1 (a score never goes below 0)
  const s = JSON.parse(store.v);
  check(s.score === 40 + 4 - 1 && s.treasury === 50000000 + 110000 - 1000 && s.best === 44,
    "a wrong answer in the other tab costs only its own 1 point and 1,000 (score 43, best stays 44)");
}
{ // starting class: the first pick wins; a tab that picks later takes it, and can never change it
  const store = { v: null }, A = Tab(store), B = Tab(store);       // both opened before any pick
  A.pick("Class 10"); B.pick("Class 12");
  const s = JSON.parse(store.v);
  check(s.start === idx("Class 10") && B.S.start === idx("Class 10"), "two tabs pick different starting classes: the first pick (Class 10) wins");
  check(st(s, "Class 8").locked && st(s, "Class 9").locked && st(s, "Class 10").full && !st(s, "Class 12").full, "...and only its classes are open (Class 12 is not opened by the later pick)");
}
{ // badges and completed bridges: the union; fewer parts is better; settings stay the saving tab's
  const store = { v: null }, A = Tab(store); A.pick("Class 12"); const B = Tab(store);
  A.S.badges.first = "2026-11-20"; A.S.complete[8] = true; A.S.bestParts[8] = 30; A.save();
  B.S.badges.first = "2026-11-25"; B.S.badges.streak3 = "2026-11-26"; B.S.complete[9] = true; B.S.bestParts[8] = 40; B.S.lang = "bn"; B.save();
  const s = JSON.parse(store.v);
  check(s.badges.first === "2026-11-20" && s.badges.streak3 && s.complete[8] && s.complete[9] && s.bestParts[8] === 30 && s.lang === "bn",
    "badges and completed bridges: union (earlier badge date kept); bestParts the lower; language the saving tab's");
}
{ // the real old-format Class 12 save opened in two tabs: still nothing locked, both tabs' answers count
  const store = { v: JSON.stringify(FIX) }, A = Tab(store), B = Tab(store);
  for (let r = 0; r < 3; r++) A.answer(12, 7000 + r);
  for (let r = 0; r < 2; r++) B.answer(12, 7100 + r);
  const s = JSON.parse(store.v);
  check(["Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].every(n => st(s, n).full) && LV.every((l, k) => !U.state(LV, s, k).locked),
    "real old save in two tabs: Classes 8 to 12 stay fully open, nothing locked");
  check(s.doneN[12] === FIX.doneN[12] + 5 && s.score === FIX.score + 20 && JSON.stringify(s.badges) === JSON.stringify(FIX.badges),
    "real old save in two tabs: 5 more right answers counted, score + 20, badges unchanged");
}

console.log(fails ? `${fails} FAILED` : "all unlock checks passed");
process.exit(fails ? 1 : 0);
