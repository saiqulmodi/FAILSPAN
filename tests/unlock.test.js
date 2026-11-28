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

console.log(fails ? `${fails} FAILED` : "all unlock checks passed");
process.exit(fails ? 1 : 0);
