// Checks the JavaScript solver against the Python one: every guided design passes with the same
// worst load ratio, empty bridges are unstable, and the weak designs from tests/test_projects.py fail.
const fs = require("fs"), path = require("path");
const { Design } = require("../js/truss.js");
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/projects.json"), "utf8"));
let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
for (const p of cat.projects) {
  const d = new Design(cat, p); d.parts = 1e4;
  for (const s of p.steps) for (const m of s.members) d.add(m[0], m[1], m[2], m[3]);
  const r = d.fullTest();
  check(r.ok && Math.abs(r.worst - p.ref_worst) < 1e-3, `project ${p.id} guided design passes, worst ${r.worst.toFixed(4)} vs python ${p.ref_worst}`);
  const e = new Design(cat, p);
  check(!e.fullTest().ok, `project ${p.id} empty bridge fails`);
}
const weak = {
  2: [[7,8],[8,9],[9,10],[10,11],[0,7],[6,11],[1,7],[2,8],[3,9],[4,10],[5,11],[7,2],[8,3],[10,3],[11,4]].map(([i,j]) => [i, j, "Steel", "M"]),
  4: [0,1,2,3,4,5,7,8,9,10,11,12].map(k => [14, k, "Steel cable", "S"]),
};
for (const id in weak) {
  const p = cat.projects[id - 1], d = new Design(cat, p); d.parts = 1e4;
  weak[id].forEach(m => d.add(...m));
  const r = d.fullTest();
  check(!r.ok, `project ${id} weak design fails: ${r.msg}`);
}
process.exit(fails ? 1 : 0);
