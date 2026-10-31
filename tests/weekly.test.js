// Every weekly challenge (each project, vehicle up to 1.3x heavier) must be winnable:
// the guided design with members upsized to the largest allowed size passes.
const fs = require("fs"), path = require("path");
const { Design } = require("../js/truss.js");
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/projects.json"), "utf8"));
let fails = 0;
for (const base of cat.projects) for (const f of [1.1, 1.2, 1.3]) {
  const p = JSON.parse(JSON.stringify(base)); p.vehicle.mass = Math.round(base.vehicle.mass * f);
  let ok = false, used = 0;
  for (const up of [0, 1, 2, 3]) {          // try the guided sizes first, then bigger
    const d = new Design(cat, p); d.parts = 1e4;
    for (const s of p.steps) for (const m of s.members) {
      const k = Math.min(p.sizes.length - 1, p.sizes.indexOf(m[3]) + up);
      d.add(m[0], m[1], m[2], p.sizes[k]);
    }
    const r = d.fullTest();
    if (r.ok) { ok = true; used = d.partsUsed(); break; }
  }
  console.log(ok ? "ok  " : "FAIL", `project ${p.id} x${f}`, ok ? `${used} parts` : "");
  if (!ok) fails++;
}
process.exit(fails ? 1 : 0);
