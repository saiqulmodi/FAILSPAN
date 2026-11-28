/* Which questions of each class are open (owner rules, 28-Nov-2026). Pure functions, no page needed, so
 * tests/unlock.test.js checks the same code the game runs.
 *
 * Class order is data/levels.json: Class 8, 9, 10, 11, 12, BE, NIT, IIT, Expert Engineer. The "previous class"
 * is the one just before in that order.
 * - The player picks a starting class (index s.start). It opens fully; classes below it stay locked for good.
 * - Every class above it has a demo: its first DEMO questions in row order (empty rows skipped).
 * - It opens fully once the previous class has FULL_AT distinct questions answered right (s.doneN); below
 *   that, DEMO + STEP x floor(right / STEP) questions are open. Wrong answers never count.
 * - What is open is saved in s.unlock and only ever goes up: { v, full: {level: 1}, open: {level: count},
 *   half: {level: 1} }. half = a class that was half open under the old rule keeps its every-second question.
 */
(function (root) {
  "use strict";
  const DEMO = 10, STEP = 10, FULL_AT = 100, VERSION = 1;

  const blank = () => ({ v: VERSION, full: {}, open: {}, half: {} });

  // what the rule gives class k now: a question count, Infinity (all), or 0 (locked)
  function rule(levels, s, k) {
    if (s.start < 0) return DEMO;
    if (k === s.start) return Infinity;
    if (k < s.start) return 0;
    const right = (s.doneN || {})[levels[k - 1].l] || 0;
    return right >= FULL_AT ? Infinity : DEMO + STEP * Math.floor(right / STEP);
  }

  // saves anything newly opened; never lowers what is saved. Returns true when something changed.
  function update(levels, s) {
    if (!s.unlock || s.unlock.v !== VERSION) s.unlock = Object.assign(blank(), s.unlock, { v: VERSION });
    const u = s.unlock;
    if (s.start < 0) return false;                  // nothing is saved before a starting class is picked
    let changed = false;
    levels.forEach((L, k) => {
      if (u.full[L.l]) return;
      const c = rule(levels, s, k);
      if (c === Infinity || c >= L.n) { u.full[L.l] = 1; changed = true; }
      else if (c > (u.open[L.l] || 0)) { u.open[L.l] = c; changed = true; }
    });
    return changed;
  }

  // what is open in class k: full, count (first `count` questions in row order), half, locked
  function state(levels, s, k) {
    const L = levels[k], u = s.unlock || blank();
    const full = !!u.full[L.l];
    const half = !full && !!u.half[L.l];
    const below = s.start >= 0 && k < s.start;      // below the starting class: locked unless kept from before
    const count = full ? L.n : below ? 0 : Math.min(L.n, Math.max(u.open[L.l] || 0, rule(levels, s, k)));
    return { full: full || count >= L.n, count, half, locked: !full && count === 0 && !half };
  }

  // the open questions of a class; `all` = its questions in row order (empty rows already left out), each with
  // its row number in q.i
  function pool(all, st) {
    if (st.full) return all.slice();
    return all.filter((q, j) => j < st.count || (st.half && q.i % 2 === 0));
  }

  // one time: a player who had saved progress before these rules keeps exactly what was open then
  // (old rule: classes up to the chosen one fully open; previous class 100% answered right -> fully open,
  // 50% -> every second question open). Nothing else in the saved progress is touched.
  function migrate(levels, s, existing) {
    if (s.unlock && s.unlock.v === VERSION) return false;
    s.unlock = blank();
    if (existing && s.start >= 0) {
      levels.forEach((L, k) => {
        if (k <= s.start) { s.unlock.full[L.l] = 1; return; }
        const P = levels[k - 1], c = Math.min(1, ((s.doneN || {})[P.l] || 0) / Math.max(1, P.n));
        if (c >= 1) s.unlock.full[L.l] = 1; else if (c >= 0.5) s.unlock.half[L.l] = 1;
      });
    }
    update(levels, s);
    return true;
  }

  const api = { DEMO, STEP, FULL_AT, VERSION, rule, update, state, pool, migrate };
  root.BWUnlock = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
