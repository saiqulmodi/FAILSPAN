(function () {
  "use strict";
  const CYCLE_KEY = "ncert_hub_cycle_v1";
  const MISSED_KEY = "ncert_hub_missed_v1";
  const NINETY_DAYS = 90 * 86400 * 1000;
  const HUB_URLS = ["http://localhost:8094", "../NCERT_QA_Hub", "https://saiqulmodi.github.io/NCERT_QA_Hub"];

  function readJson(k, fb) { try { return JSON.parse(localStorage.getItem(k) || "null") || fb; } catch (_) { return fb; } }
  function writeJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  function detectGameKey() {
    const t = (document.title || "").toLowerCase();
    if (t.includes("failspan")) return "failspan";
    if (t.includes("bridgeworks")) return "bridgeworks";
    return "ecossynthetica";
  }

  function getCycle() {
    let c = readJson(CYCLE_KEY, null);
    if (!c || !c.quarter) {
      c = { quarter: "q1", startedAt: Date.now(), archived: {} };
      writeJson(CYCLE_KEY, c);
    }
    return c;
  }

  function isRotationDue(solvedRatio) {
    const c = getCycle();
    return (Date.now() - (c.startedAt || 0) >= NINETY_DAYS) || (solvedRatio >= 0.8);
  }

  async function fetchBatch(batchName) {
    const c = getCycle();
    for (const base of HUB_URLS) {
      try {
        const res = await fetch(`${base}/batches/${c.quarter}/${batchName}.json`, { cache: "no-store" });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    return null;
  }

  async function rotateQuarter(gameKey, solvedIds) {
    const c = getCycle();
    let quarters = ["q1", "q2"];
    for (const base of HUB_URLS) {
      try {
        const res = await fetch(`${base}/manifest.json`, { cache: "no-store" });
        if (res.ok) {
          const m = await res.json();
          if (Array.isArray(m.quarters) && m.quarters.length) quarters = m.quarters;
          break;
        }
      } catch (_) {}
    }
    const idx = quarters.indexOf(c.quarter);
    const nextQ = quarters[(idx + 1) % quarters.length];
    c.archived[gameKey] = Array.from(new Set([...(c.archived[gameKey] || []), ...(solvedIds || [])]));
    c.quarter = nextQ;
    c.startedAt = Date.now();
    writeJson(CYCLE_KEY, c);
    return nextQ;
  }

  function getMissed(gameKey) {
    const m = readJson(MISSED_KEY, {});
    return Array.isArray(m[gameKey]) ? m[gameKey] : [];
  }

  function recordOutcome(gameKey, qId, isCorrect) {
    const m = readJson(MISSED_KEY, {});
    const set = new Set(Array.isArray(m[gameKey]) ? m[gameKey] : []);
    if (isCorrect) set.delete(qId); else set.add(qId);
    m[gameKey] = [...set];
    writeJson(MISSED_KEY, m);
    refreshBar();
    return m[gameKey];
  }

  // --- Self-contained HUD Bar: Mistake Notebook, 10Q Timed Sprint, Mastery Heatmap & 90-Day Rotation ---
  let sprintTimer = null;
  let sprintSecs = 0;

  function toggleSprint(btn) {
    if (sprintTimer) {
      clearInterval(sprintTimer);
      sprintTimer = null;
      btn.textContent = "⏱️ 10Q Sprint";
      return;
    }
    sprintSecs = 600;
    btn.textContent = "⏱️ 10:00";
    sprintTimer = setInterval(() => {
      sprintSecs--;
      if (sprintSecs <= 0) {
        clearInterval(sprintTimer);
        sprintTimer = null;
        btn.textContent = "⏱️ Time Up!";
        return;
      }
      const m = String(Math.floor(sprintSecs / 60)).padStart(2, "0");
      const s = String(sprintSecs % 60).padStart(2, "0");
      btn.textContent = `⏱️ ${m}:${s}`;
    }, 1000);
  }

  function computeMastery() {
    let done = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.includes("failspan") || k.includes("bridgeworks") || k.includes("ecos")) {
          const val = localStorage.getItem(k) || "";
          const matches = val.match(/"(right|done|answered)"/g);
          if (matches) done += matches.length;
        }
      }
    } catch (_) {}
    return Math.min(100, done);
  }

  function refreshBar() {
    const bar = document.getElementById("ncertHubBar");
    if (!bar) return;
    const gKey = detectGameKey();
    const c = getCycle();
    const missedCount = getMissed(gKey).length;
    const mastery = computeMastery();
    const due = isRotationDue(mastery / 100);
    const daysLeft = Math.max(0, 90 - Math.floor((Date.now() - c.startedAt) / 86400000));

    bar.querySelector("#nhMissedBtn").textContent = `↻ Missed (${missedCount})`;
    bar.querySelector("#nhHeatLabel").textContent = `📊 Mastery ${mastery}%`;
    bar.querySelector("#nhHeatFill").style.width = `${mastery}%`;
    const rotBtn = bar.querySelector("#nhRotateBtn");
    rotBtn.textContent = due ? `🔄 Refresh Batch (${c.quarter.toUpperCase()}→Next)` : `🔄 ${c.quarter.toUpperCase()} (${daysLeft}d)`;
    rotBtn.style.background = due ? "#d97706" : "#1e293b";
  }

  function mountBar() {
    if (document.getElementById("ncertHubBar") || !document.body) return;
    const gKey = detectGameKey();
    const bar = document.createElement("div");
    bar.id = "ncertHubBar";
    bar.style.cssText = "position:fixed;bottom:10px;right:10px;z-index:9999;display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:rgba(15,23,42,0.92);color:#f8fafc;border:1px solid #334155;border-radius:10px;padding:6px 10px;font:12px/1.2 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.35)";
    bar.innerHTML = `
      <button id="nhMissedBtn" type="button" style="background:#7f1d1d;color:#fecaca;border:1px solid #991b1b;border-radius:6px;padding:4px 8px;cursor:pointer;font-weight:600">↻ Missed (0)</button>
      <button id="nhSprintBtn" type="button" style="background:#1e3a8a;color:#dbeafe;border:1px solid #1d4ed8;border-radius:6px;padding:4px 8px;cursor:pointer;font-weight:600">⏱️ 10Q Sprint</button>
      <div style="display:flex;align-items:center;gap:5px;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:4px 8px">
        <span id="nhHeatLabel">📊 Mastery 0%</span>
        <span style="width:44px;height:6px;background:#334155;border-radius:4px;overflow:hidden;display:inline-block"><span id="nhHeatFill" style="display:block;height:100%;width:0%;background:#10b981"></span></span>
      </div>
      <button id="nhRotateBtn" type="button" style="background:#1e293b;color:#fde68a;border:1px solid #475569;border-radius:6px;padding:4px 8px;cursor:pointer;font-weight:600">🔄 Q1 (90d)</button>
    `;
    // FAILSPAN: sit in the road screen's layout (under the class buttons) instead of floating over the game,
    // so it never covers the intro's Skip, the quiz answers, the bridge screen or the class buttons.
    const host = document.getElementById("screen-world");
    if (host) {
      bar.style.position = "static"; bar.style.zIndex = ""; bar.style.boxShadow = "none";
      bar.style.borderRadius = "0"; bar.style.borderWidth = "1px 0 0"; bar.style.justifyContent = "center";
      bar.style.flex = "0 0 auto";
      host.appendChild(bar);
    } else document.body.appendChild(bar);

    bar.querySelector("#nhSprintBtn").onclick = (e) => toggleSprint(e.currentTarget);
    bar.querySelector("#nhMissedBtn").onclick = () => {
      const list = getMissed(gKey);
      alert(list.length ? `Mistake Notebook (${list.length} items queued for review):\n- ${list.slice(0, 10).join("\n- ")}` : "Mistake Notebook is empty — 0 missed questions!");
    };
    bar.querySelector("#nhRotateBtn").onclick = async () => {
      const nextQ = await rotateQuarter(gKey, []);
      refreshBar();
      alert(`NCERT Q&A Hub rotated to batch ${nextQ.toUpperCase()}! Solved items archived; fresh quarterly questions are now active.`);
    };
    refreshBar();
  }

  window.NcertHubClient = {
    getCycle,
    isRotationDue,
    fetchBatch,
    rotateQuarter,
    getMissed,
    recordOutcome,
    refreshBar
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountBar);
  } else {
    mountBar();
  }
})();