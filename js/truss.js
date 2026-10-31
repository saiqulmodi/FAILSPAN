/* FAILSPAN truss solver and bridge design - a JavaScript port of engine/truss.py and game/projects.py.
 *
 * Direct Stiffness Method: every member is a spring k = E A / L along its length. All springs go
 * into one stiffness matrix K and we solve [K]{U} = {F} for the joint movements U, then each
 * member's force N, stress N/A, and checks for snapping, crushing and Euler buckling.
 * N > 0 is tension, N < 0 compression. Units: metres, newtons, pascals; +y is up.
 */
(function (root) {
  "use strict";
  const G = 9.81;
  const GREEN = "green", YELLOW = "yellow", RED = "red", FAILED = "failed";

  class UnstableStructure extends Error {}

  function statusFor(r) { return r > 1 ? FAILED : r >= 0.8 ? RED : r >= 0.5 ? YELLOW : GREEN; }

  // Solve A x = b by Gaussian elimination with partial pivoting; null if A is singular.
  function solveLinear(A, b, tolScale) {
    const n = b.length, M = A.map((row, i) => row.slice().concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < tolScale) return null;
      if (p !== c) { const t = M[p]; M[p] = M[c]; M[c] = t; }
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        if (f !== 0) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }

  class TrussSolver {
    constructor(nodes, members) {
      this.nodes = nodes; this.members = members;
      this.geom = members.map(m => {
        const a = nodes[m.i], b = nodes[m.j], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
        if (L === 0) throw new Error("zero-length member");
        return [L, dx / L, dy / L];
      });
      this.fixed = []; this.free = [];
      nodes.forEach((nd, k) => {
        (nd.fixX ? this.fixed : this.free).push(2 * k);
        (nd.fixY ? this.fixed : this.free).push(2 * k + 1);
      });
      this.free.sort((a, b) => a - b);
    }

    stiffness(skip) {
      const n = 2 * this.nodes.length, K = Array.from({ length: n }, () => new Array(n).fill(0));
      this.members.forEach((m, idx) => {
        if (skip.has(idx)) return;
        const [L, c, s] = this.geom[idx], k = m.E * m.A / L;
        const e = [[c * c, c * s, -c * c, -c * s], [c * s, s * s, -c * s, -s * s],
                   [-c * c, -c * s, c * c, c * s], [-c * s, -s * s, c * s, s * s]];
        const d = [2 * m.i, 2 * m.i + 1, 2 * m.j, 2 * m.j + 1];
        for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) K[d[r]][d[q]] += k * e[r][q];
      });
      return K;
    }

    elongation(idx, U) {
      const m = this.members[idx], [, c, s] = this.geom[idx];
      return c * (U[2 * m.j] - U[2 * m.i]) + s * (U[2 * m.j + 1] - U[2 * m.i + 1]);
    }

    solve(extra) {
      const n = 2 * this.nodes.length, F = new Array(n).fill(0);
      for (const k in extra || {}) { F[2 * k] += extra[k][0]; F[2 * k + 1] += extra[k][1]; }
      const cables = [];
      this.members.forEach((m, k) => { if (m.tensionOnly) cables.push(k); });
      let slack = new Set(), U = new Array(n).fill(0), K = null;
      for (let it = 0; it < 2 * cables.length + 2; it++) {
        K = this.stiffness(slack);
        const Kff = this.free.map(r => this.free.map(c => K[r][c]));
        let scale = 0;
        for (const row of Kff) for (const v of row) scale = Math.max(scale, Math.abs(v));
        const sol = this.free.length ? solveLinear(Kff, this.free.map(r => F[r]), 1e-9 * (scale || 1)) : [];
        if (sol === null || (this.free.length && scale === 0))
          throw new UnstableStructure("The structure can wobble freely - add diagonal braces to make triangles" +
                                      " (and remember cables can only pull, never push).");
        U = new Array(n).fill(0);
        this.free.forEach((d, k) => { U[d] = sol[k]; });
        const now = new Set(cables.filter(k => this.elongation(k, U) < -1e-12));
        const same = now.size === slack.size && [...now].every(k => slack.has(k));
        if (same) break;
        const added = [...now].filter(k => !slack.has(k));
        if (added.length) {
          const worst = added.reduce((a, b) => (this.elongation(b, U) < this.elongation(a, U) ? b : a));
          slack = new Set([...slack].filter(k => now.has(k)).concat([worst]));
        } else slack = now;
      }
      const results = this.members.map((m, idx) => {
        const L = this.geom[idx][0];
        const N = slack.has(idx) ? 0 : m.E * m.A / L * this.elongation(idx, U);
        return memberResult(m, N, L, slack.has(idx));
      });
      const disp = this.nodes.map((_, k) => [U[2 * k], U[2 * k + 1]]);
      return { members: results, displacements: disp,
               maxRatio: results.reduce((a, r) => Math.max(a, r.ratio), 0),
               worst: results.reduce((b, r, k) => (b < 0 || r.ratio > results[b].ratio ? k : b), -1),
               failed: results.some(r => r.status === FAILED) };
    }
  }

  function memberResult(m, N, L, slack) {
    const ts = m.mat.t, cs = m.mat.c, Pcr = Math.PI ** 2 * m.E * m.I / (L * L);
    const stress = N / m.A, tiny = 1e-6;
    if (slack) return { N: 0, ratio: 0, status: GREEN, slack: true, explanation: "Slack: cables can only pull, never push" };
    let limit, ratio, mode, ex;
    if (N > tiny) {
      limit = ts * m.A; ratio = limit > 0 ? N / limit : Infinity; mode = "yield";
      ex = `Tension: σ = N/A = ${(N / 1e3).toFixed(1)} kN / ${(m.A * 1e4).toFixed(1)} cm² = ${(stress / 1e6).toFixed(1)} MPa (limit ${(ts / 1e6).toFixed(0)} MPa)`;
    } else if (N < -tiny) {
      const crush = cs * m.A;
      limit = Math.min(crush, Pcr); ratio = limit > 0 ? -N / limit : Infinity;
      mode = Pcr < crush ? "buckling" : "yield";
      ex = mode === "buckling"
        ? `Compression: ${(-N / 1e3).toFixed(1)} kN vs Euler P_cr = π²EI/L² = ${(Pcr / 1e3).toFixed(1)} kN`
        : `Compression: σ = ${(stress / 1e6).toFixed(1)} MPa (crush limit ${(cs / 1e6).toFixed(0)} MPa)`;
    } else { ratio = 0; mode = ""; ex = "Unloaded (zero-force member)"; }
    const status = statusFor(ratio);
    if (status === FAILED) {
      if (mode === "buckling") ex = `BUCKLED: ${(-N / 1e3).toFixed(0)} kN pushed it past P_cr ${(Pcr / 1e3).toFixed(0)} kN`;
      else if (N > 0) ex = `SNAPPED: ${(stress / 1e6).toFixed(1)} MPa pulled past its ${(ts / 1e6).toFixed(0)} MPa strength`;
      else ex = `CRUSHED: ${(-stress / 1e6).toFixed(1)} MPa squeezed past its ${(cs / 1e6).toFixed(0)} MPa strength`;
    }
    return { N, ratio, status, slack: false, mode: status === FAILED ? mode : "", explanation: ex };
  }

  // ---------------- a student's design for one project ----------------
  class Design {
    constructor(cat, project) {
      this.cat = cat; this.p = project; this.members = []; this.parts = 0; this.cache = null;
    }
    length(i, j) { const a = this.p.joints[i], b = this.p.joints[j]; return Math.hypot(b[0] - a[0], b[1] - a[1]); }
    taken(i, j) {
      const same = (a, b) => (a === i && b === j) || (a === j && b === i);
      return this.p.prebuilt.some(m => same(m[0], m[1])) || this.members.some(m => same(m[0], m[1]));
    }
    canAdd(i, j, size) {
      if (i === j) return "Pick two different joints.";
      if (this.taken(i, j)) return "Those joints are already joined.";
      const c = this.cat.size_cost[size];
      if (this.parts < c) return `Need ${c} parts for size ${size} - answer questions to earn parts.`;
      return "";
    }
    add(i, j, mat, size) {
      const msg = this.canAdd(i, j, size);
      if (!msg) { this.members.push([i, j, mat, size]); this.parts -= this.cat.size_cost[size]; this.cache = null; }
      return msg;
    }
    remove(k) { const m = this.members.splice(k, 1)[0]; this.parts += this.cat.size_cost[m[3]]; this.cache = null; }
    clear() { while (this.members.length) this.remove(this.members.length - 1); }
    partsUsed() { return this.members.reduce((s, m) => s + this.cat.size_cost[m[3]], 0); }
    all() {   // [i, j, material, size, kind, player index or -1]
      return this.p.prebuilt.map(m => [m[0], m[1], m[2], m[3], m[4], -1])
        .concat(this.members.map((m, k) => [m[0], m[1], m[2], m[3], this.cat.materials[m[2]].cable ? "cable" : "beam", k]));
    }
    member(i, j, matName, size, kind) {
      const mat = this.cat.materials[matName];
      let A, I;
      if (kind === "pylon") { A = this.cat.pylon_area; I = this.cat.shapes.box * A * A; }
      else if (mat.cable) { A = this.cat.cable_sizes[size]; I = this.cat.shapes.solid * A * A; kind = "cable"; }
      else { A = this.cat.beam_sizes[size]; I = this.cat.shapes.ibeam * A * A; }
      return { i, j, mat, E: mat.E, A, I, kind, tensionOnly: mat.cable };
    }
    build() {
      const p = this.p;
      const nodes = p.joints.map((xy, k) => {
        const s = p.supports[String(k)];
        return { x: xy[0], y: xy[1], fixX: s === "pin", fixY: s === "pin" || s === "roller" };
      });
      const members = this.all().map(m => this.member(m[0], m[1], m[2], m[3], m[4]));
      const base = {};
      members.forEach(m => {
        const a = nodes[m.i], b = nodes[m.j], L = Math.hypot(b.x - a.x, b.y - a.y);
        let w = m.mat.rho * m.A * L * G;
        if (m.kind === "deck") w += p.dead_load * L;
        for (const n of [m.i, m.j]) { base[n] = base[n] || [0, 0]; base[n][1] -= w / 2; }
      });
      return { solver: new TrussSolver(nodes, members), base };
    }
    vehicleLoads(front) {
      const p = this.p, v = p.vehicle, w = v.mass * G * p.impact / v.axles.length, loads = {};
      for (const off of v.axles) {
        const x = front - off;
        if (x < 0 || x > p.span) continue;
        for (let k = 0; k < p.n_deck - 1; k++) {
          const x0 = p.joints[k][0], x1 = p.joints[k + 1][0];
          if (x0 <= x && x <= x1) {
            const t = (x - x0) / (x1 - x0);
            loads[k] = [0, (loads[k] ? loads[k][1] : 0) - w * (1 - t)];
            loads[k + 1] = [0, (loads[k + 1] ? loads[k + 1][1] : 0) - w * t];
            break;
          }
        }
      }
      return loads;
    }
    vehicleLength() { return Math.max(...this.p.vehicle.axles) + 2; }
    solveAt(front) {
      if (!this.cache) this.cache = this.build();
      const loads = {};
      for (const k in this.cache.base) loads[k] = this.cache.base[k].slice();
      const vl = this.vehicleLoads(front);
      for (const k in vl) { loads[k] = loads[k] || [0, 0]; loads[k][0] += vl[k][0]; loads[k][1] += vl[k][1]; }
      return this.cache.solver.solve(loads);
    }
    fullTest(step = 0.5) {
      let worst = 0;
      try {
        for (let x = 0; x <= this.p.span + this.vehicleLength(); x += step) {
          const r = this.solveAt(x);
          worst = Math.max(worst, r.maxRatio);
          if (r.failed) return { ok: false, msg: r.members[r.worst].explanation, worst };
        }
      } catch (e) {
        if (e instanceof UnstableStructure) return { ok: false, msg: e.message, worst };
        throw e;
      }
      return { ok: true, msg: "", worst };
    }
  }

  const api = { TrussSolver, Design, UnstableStructure, FAILED, RED, YELLOW, GREEN, G };
  root.BWTruss = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
