/* js/gurukul-bridge.js — Zero-miss 4-game state & navigation bridge for Stratos Gurukul */
(function () {
  "use strict";
  const HUB_KEY = "gurukul_hub_v1";

  const GAMES = {
    "nala-setu": {
      title: "NALA-SETU",
      subtitle: "MODIS BridgeWorks · 5-Phase NCERT Civil Sandbox",
      icon: "🪨",
      path: "../MODIS_BridgeWorks/",
      port: 8090
    },
    "setu-shilpa": {
      title: "SETU-SHILPA",
      subtitle: "FAILSPAN · 3D Truss Physics & JEE Engineering",
      icon: "🌉",
      path: "../FAILSPAN/",
      port: 8091
    },
    "ayur-jiva": {
      title: "AYUR-JIVA",
      subtitle: "Ecos-Synthetica · Biology & NEET Prep",
      icon: "🌿",
      path: "../MODIS_EcosSynthetica/",
      port: 8092
    },
    "bala-gurukul": {
      title: "BALA-GURUKUL",
      subtitle: "Domino Wonder Dash · Classes 1–7",
      icon: "🪔",
      path: "../DominoGame/",
      port: 8093
    }
  };

  function safeRead() {
    try {
      const raw = localStorage.getItem(HUB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { v: 1, xp: 0, streak: 0, lastDay: "", lang: "en", badges: {}, games: {} };
  }

  function safeWrite(data) {
    try {
      localStorage.setItem(HUB_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function todayISO(offsetDays = 0) {
    return new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10);
  }

  function sync(gameId, payload) {
    if (!GAMES[gameId]) return safeRead();
    const hub = safeRead();
    const today = todayISO(0);
    const yesterday = todayISO(-1);

    if (hub.lastDay !== today) {
      hub.streak = hub.lastDay === yesterday ? (hub.streak || 0) + 1 : 1;
      hub.lastDay = today;
    }

    hub.games[gameId] = {
      ...(hub.games[gameId] || {}),
      ...payload,
      updated: today
    };

    if (payload.lang) hub.lang = payload.lang;
    hub.xp = Object.values(hub.games).reduce((sum, g) => sum + (Number(g.score) || 0), 0);
    safeWrite(hub);
    return hub;
  }

  function gameUrl(gameId, hubRoot = "../stratos-family-os/docs/") {
    const g = GAMES[gameId];
    if (!g) return hubRoot;
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const base = isLocal ? `http://${location.hostname}:${g.port}/` : g.path;
    const params = new URLSearchParams();
    const cur = new URLSearchParams(location.search);
    if (cur.has("unlock")) params.set("unlock", cur.get("unlock"));
    const lang = cur.get("lang") || safeRead().lang;
    if (lang && lang !== "en") params.set("lang", lang);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  window.GurukulBridge = { GAMES, read: safeRead, sync, gameUrl };
})();