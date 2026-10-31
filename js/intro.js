/* Opening theme: "small steps, bigger every class".
 * A spiral of dominoes, one per step of the journey (Class 1 ... Expert Engineer). The first is tiny;
 * each next one is bigger than the one before, and the chain runs round and outward in a circle while the
 * camera pulls back to keep up - growing into a bigger, more knowledgeable person. Each hit throws sparks
 * and a ring; the fallen ones glow gold. After Expert falls: a flash, then FAILSPAN slams in.
 * Tap or Skip ends it at once.
 */
(function (root) {
  "use strict";
  const GROW = 1.19;           // each domino is 19% bigger than the one before
  const STEP = 0.3;            // seconds between one domino being hit and the next
  const PER_TURN = 9;         // dominoes per turn of the spiral
  const TILT = 0.48;           // how flat the ground looks (camera looking down at an angle)

  // freezeAt (seconds) holds one moment on screen - used to check frames and make the store thumbnail
  function play({ labels, title, subtitle, tagline = "", stressLabel = "STRESS COEFFICIENT", skipText, click, onDone, freezeAt = null }) {
    const box = document.createElement("div");
    box.id = "intro";
    box.innerHTML = `<canvas></canvas><button class="skip">${skipText}</button>`;
    document.body.appendChild(box);
    const cv = box.querySelector("canvas"), cx = cv.getContext("2d");
    let W = 0, H = 0, done = false, start = 0, raf = 0;
    function resize() {
      const d = Math.min(2, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      cv.width = W * d; cv.height = H * d; cv.style.width = W + "px"; cv.style.height = H + "px";
      cx.setTransform(d, 0, 0, d, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // ---- the spiral: domino k stands at radius ~ its own size, so the gaps grow with the dominoes ----
    const n = labels.length, dth = (Math.PI * 2) / PER_TURN, doms = [];
    for (let k = 0; k < n; k++) {
      const h = Math.pow(GROW, k), r = 1.25 * h, th = k * dth - Math.PI / 2;
      // tangent of the spiral (direction of the fall), pointing to the next domino
      const b = Math.log(GROW) / dth;
      let tx = b * Math.cos(th) - Math.sin(th), tz = b * Math.sin(th) + Math.cos(th);
      const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
      doms.push({ x: r * Math.cos(th), z: r * Math.sin(th), h, w: h * 0.42, tx, tz, label: labels[k], hitAt: 0.35 + k * STEP, ang: 0, rest: 0, hit: false });
    }
    doms.forEach((d, k) => {
      const nx = doms[k + 1];
      d.rest = nx ? Math.asin(Math.min(0.97, Math.hypot(nx.x - d.x, nx.z - d.z) / d.h)) : 1.5;
    });
    const lastHit = doms[n - 1].hitAt, boomAt = lastHit + 0.3, titleAt = boomAt + 0.15, endAt = titleAt + 3.0;

    // stars
    const stars = Array.from({ length: 90 }, () => [Math.random(), Math.random() * 0.75, Math.random() * 1.4 + 0.3]);
    const sparks = [], rings = [];

    // camera: fit the dominoes reached so far (zooms out as they grow)
    function view(t) {
      const reach = Math.max(0, Math.min(n - 1, (t - 0.35) / STEP + 1.2));
      const k = Math.floor(reach), f = reach - k;
      const size = k >= n - 1 ? doms[n - 1].h : doms[k].h * Math.pow(GROW, f);
      const ext = size * 1.9 + 0.3;
      const s = Math.min(W * 0.46, H * 0.6) / ext;
      const e = Math.max(0, Math.min(1, (t - boomAt) / 0.6)), es = e * e * (3 - 2 * e);
      return { s: s * (1 + 0.15 * es), ox: W / 2, oy: H * (0.58 + 0.12 * es) };
    }
    const P = (v, x, z, y = 0) => [v.ox + x * v.s, v.oy + z * v.s * TILT - y * v.s * 0.92];

    function drawDomino(d0, v, t) {
      const ap = Math.max(0, Math.min(1, (t - (d0.hitAt - 2.2 * STEP)) / 0.3));
      if (ap <= 0) return;
      const pop = 1 + 2.2 * Math.pow(ap - 1, 3) + 1.2 * Math.pow(ap - 1, 2);   // ease-out with a little overshoot
      const d = Object.assign({}, d0, { h: d0.h * pop, w: d0.w * Math.min(1, ap * 1.5) });
      const [bx, by] = P(v, d.x - (-d.tz) * d.w / 2, d.z - d.tx * d.w / 2);       // base corner
      const wx = -d.tz * d.w * v.s, wy = d.tx * d.w * v.s * TILT;                  // width vector on screen
      const ux = d.tx * Math.sin(d.ang) * d.h * v.s;                               // height vector (tips along the path)
      const uy = d.tz * Math.sin(d.ang) * d.h * v.s * TILT - Math.cos(d.ang) * d.h * v.s * 0.92;
      // shadow on the ground
      cx.fillStyle = "rgba(0,0,0,.35)";
      cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx + wx, by + wy); cx.lineTo(bx + wx + d.tx * d.h * v.s * 0.5, by + wy + d.tz * d.h * v.s * TILT * 0.5);
      cx.lineTo(bx + d.tx * d.h * v.s * 0.5, by + d.tz * d.h * v.s * TILT * 0.5); cx.closePath(); cx.fill();
      // face: an affine map of the unit square onto the parallelogram
      cx.save();
      cx.transform(wx, wy, ux, uy, bx, by);
      const glow = d.hit ? Math.min(1, (t - d.hitAt) / 0.4) : 0;
      const g = cx.createLinearGradient(0, 0, 1, 1);
      g.addColorStop(0, glow ? `rgb(${255},${Math.round(250 - 40 * glow)},${Math.round(235 - 160 * glow)})` : "#f8fafc");
      g.addColorStop(1, glow ? `rgb(${Math.round(250 - 20 * glow)},${Math.round(190 - 30 * glow)},${Math.round(80 - 40 * glow)})` : "#cbd5e1");
      cx.fillStyle = g; cx.fillRect(0, 0, 1, 1);
      cx.restore();
      // outline
      cx.strokeStyle = d.hit ? "rgba(251,146,60,.9)" : "#0f172a"; cx.lineWidth = Math.max(1, d.w * v.s * 0.05);
      cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx + wx, by + wy); cx.lineTo(bx + wx + ux, by + wy + uy); cx.lineTo(bx + ux, by + uy); cx.closePath(); cx.stroke();
      // label, written up the face
      const faceH = Math.hypot(ux, uy), faceW = Math.hypot(wx, wy);
      if (faceH > 22 && faceW > 7) {
        cx.save();
        cx.translate(bx + wx / 2 + ux / 2, by + wy / 2 + uy / 2);
        cx.rotate(Math.atan2(uy, ux));
        const fs = Math.min(faceW * 0.62, faceH * 0.86 / Math.max(4, d.label.length * 0.6));
        cx.font = `700 ${fs}px "Chakra Petch", Segoe UI, system-ui, sans-serif`; cx.textAlign = "center"; cx.textBaseline = "middle";
        cx.fillStyle = d.hit ? "#7c2d12" : "#0b1120"; cx.fillText(d.label, 0, 0, faceH * 0.86);
        cx.restore();
      }
    }

    function burst(d, k) {
      const nx = doms[k + 1], x = nx ? nx.x : d.x + d.tx * d.h, z = nx ? nx.z : d.z + d.tz * d.h;
      const y = nx ? nx.h * 0.75 : 0.1, many = 10 + k * 2;
      for (let i = 0; i < many; i++) {
        const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 1.6) * d.h;
        sparks.push({ x, z, y, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (0.5 + Math.random() * 1.8) * d.h, life: 0.6 + Math.random() * 0.5, age: 0, size: d.h });
      }
      rings.push({ x: d.x, z: d.z, r0: d.h * 0.2, r1: d.h * 1.4, age: 0 });
    }

    // ---- the FAILSPAN logo scene (drawn in the logo's own 964 x 412 design units) ----
    const logoSparks = [];
    let snapped = false;
    const ease = q => q * q * (3 - 2 * q), cl = q => Math.max(0, Math.min(1, q));
    function spaced(text, x, y, gap) {          // letter-spaced text centred on x
      const ws = [...text].map(c => cx.measureText(c).width), total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
      let px = x - total / 2;
      [...text].forEach((c, i) => { cx.fillText(c, px + ws[i] / 2, y); px += ws[i] + gap; });
    }
    function drawLogo(u) {
      const k = Math.min(W * 0.94 / 600, H * 0.8 / 300), X = x => W / 2 + (x - 482) * k, Y = y => H * 0.44 + (y - 230) * k;
      const sag = ease(cl((u - 0.2) / 1.0)), droop = ease(cl((u - 1.2) / 0.5)), txt = cl((u - 1.3) / 0.5);
      if (u >= 1.2 && !snapped) {
        snapped = true;
        if (click && freezeAt === null) click(n + 2, n);
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 260) * k;
          logoSparks.push({ x: 488, y: 262, vx: Math.cos(a) * sp / k, vy: (Math.sin(a) * sp - 120 * k) / k, age: 0, life: 0.5 + Math.random() * 0.6 });
        }
      }
      const shake = u > 1.2 && u < 1.55 ? (1 - (u - 1.2) / 0.35) * 7 * k : 0;
      cx.save();
      cx.globalAlpha = cl(u / 0.3);
      cx.fillStyle = "#0a0e1a"; cx.fillRect(0, 0, W, H);
      // faint grid and the dashed circle
      cx.strokeStyle = "rgba(51,65,85,.25)"; cx.lineWidth = 1;
      const gs = 40 * k;
      for (let x = (W / 2) % gs; x < W; x += gs) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
      for (let y = (H * 0.44) % gs; y < H; y += gs) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
      cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      cx.setLineDash([6 * k, 6 * k]); cx.strokeStyle = "rgba(59,130,246,.45)"; cx.lineWidth = 1.5 * k;
      cx.beginPath(); cx.arc(X(482), Y(200), 178 * k, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]);
      // ghost of the road line
      cx.strokeStyle = "rgba(37,99,235,.35)"; cx.lineWidth = 4 * k;
      cx.beginPath(); cx.moveTo(X(240), Y(212)); cx.lineTo(X(420), Y(212)); cx.lineTo(X(482), Y(212 + 36 * Math.max(sag, droop))); cx.lineTo(X(545), Y(212)); cx.lineTo(X(727), Y(212)); cx.stroke();
      // towers
      cx.fillStyle = "#2563eb";
      for (const [a, b, c, d] of [[226, 258, 262, 215], [706, 738, 765, 703]]) {
        cx.beginPath(); cx.moveTo(X(a), Y(152)); cx.lineTo(X(b), Y(152)); cx.lineTo(X(c), Y(262)); cx.lineTo(X(d), Y(262)); cx.closePath(); cx.fill();
      }
      // main cable (sags a little more under load) and the hangers
      const cy = 264 + 10 * sag;
      const cableY = x => { const s = (x - 238) / (727 - 238); return (1 - s) * (1 - s) * 152 + 2 * s * (1 - s) * cy + s * s * 152; };
      cx.strokeStyle = "rgba(147,197,253,.75)"; cx.lineWidth = 1.5 * k;
      for (const hx of [305, 370, 433, 532, 593, 655]) { cx.beginPath(); cx.moveTo(X(hx), Y(cableY(hx))); cx.lineTo(X(hx), Y(268)); cx.stroke(); }
      cx.strokeStyle = "#60a5fa"; cx.lineWidth = 6 * k; cx.lineCap = "round";
      cx.beginPath(); cx.moveTo(X(238), Y(152)); cx.quadraticCurveTo(X(482), Y(cy), X(727), Y(152)); cx.stroke();
      // the road deck: one beam that sags, then snaps into two drooping halves
      cx.strokeStyle = "#f8fafc"; cx.lineWidth = 8 * k; cx.lineCap = "butt";
      if (u < 1.2) {
        const mid = 238 + 26 * sag;
        cx.beginPath(); cx.moveTo(X(240), Y(238)); cx.quadraticCurveTo(X(484), Y(2 * mid - 238), X(727), Y(238)); cx.stroke();
      } else {
        const lt = 251 + 71 * droop, rt = 251 + 17 * droop;
        cx.beginPath(); cx.moveTo(X(240), Y(238)); cx.quadraticCurveTo(X(380), Y(244 + 8 * droop), X(478), Y(lt)); cx.stroke();
        cx.beginPath(); cx.moveTo(X(500), Y(rt)); cx.quadraticCurveTo(X(610), Y(244), X(727), Y(238)); cx.stroke();
        // yellow crack
        cx.strokeStyle = "#fbbf24"; cx.lineWidth = 3.5 * k; cx.lineJoin = "miter";
        cx.shadowColor = "#f59e0b"; cx.shadowBlur = 12 * k * (1 - droop * 0.6);
        cx.beginPath(); cx.moveTo(X(478), Y(258)); cx.lineTo(X(489), Y(272)); cx.lineTo(X(470), Y(258 + 54 * droop)); cx.stroke();
        cx.shadowBlur = 0;
      }
      // sparks from the break
      cx.globalCompositeOperation = "lighter";
      for (const p of logoSparks) {
        p.age += 1 / 60; if (p.age > p.life) continue;
        p.vy += 420 / 60; p.x += p.vx / 60; p.y += p.vy / 60;
        const a = 1 - p.age / p.life;
        cx.fillStyle = `rgba(255,${Math.round(170 + 70 * a)},60,${a})`; cx.beginPath(); cx.arc(X(p.x), Y(p.y), Math.max(1, 2.2 * k), 0, 7); cx.fill();
      }
      cx.globalCompositeOperation = "source-over";
      // name and subtitle
      cx.textAlign = "center"; cx.textBaseline = "alphabetic";
      cx.globalAlpha = cl(u / 0.3) * txt;
      cx.fillStyle = "#f8fafc"; cx.font = `600 ${34 * k}px "Chakra Petch", Consolas, monospace`;
      spaced(title, X(482), Y(345), 12 * k);
      cx.fillStyle = "#60a5fa"; cx.font = `600 ${15 * k}px "Chakra Petch", Segoe UI, sans-serif`;
      spaced(tagline, X(482), Y(390), 5 * k);
      cx.restore();
      // stress readout, bottom left: counts up with the load, red once it snaps
      cx.globalAlpha = cl(u / 0.3);
      cx.textAlign = "left"; cx.fillStyle = u >= 1.2 ? "#f87171" : "#f8fafc";
      cx.font = `700 ${Math.max(12, Math.min(18, 15 * k))}px "Chakra Petch", Segoe UI, sans-serif`;
      cx.fillText(`${stressLabel}: ${(94.3 * ease(cl((u - 0.2) / 1.0))).toFixed(1)} kN/m²`, 16, H - 18);
      cx.globalAlpha = 1;
    }

    let lastT = 0;
    function frame(now) {
      if (done) return;
      if (!start) start = now;
      const t = freezeAt !== null ? freezeAt : (now - start) / 1000, dt = Math.max(0, Math.min(0.05, t - lastT)); lastT = t;
      const v = view(t);
      // sky
      const bg = cx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, Math.max(W, H) * 0.8);
      bg.addColorStop(0, "#3b1d5c"); bg.addColorStop(0.45, "#1e1b4b"); bg.addColorStop(1, "#070b18");
      cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
      for (const [sx, sy, sr] of stars) { cx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 2 + sx * 40)})`; cx.fillRect(sx * W, sy * H, sr, sr); }
      // the path, glowing where the dominoes have already fallen
      cx.lineCap = "round";
      for (let k = 0; k < n - 1; k++) {
        const a = doms[k], b = doms[k + 1]; if (t < b.hitAt - 2.2 * STEP) break;
        const [x1, y1] = P(v, a.x, a.z), [x2, y2] = P(v, b.x, b.z);
        cx.strokeStyle = a.hit ? "rgba(251,191,36,.75)" : "rgba(148,163,184,.25)"; cx.lineWidth = Math.max(1.5, a.h * v.s * 0.06);
        cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
      }
      // fall: each domino tips when hit and leans on the next; the last one falls flat
      doms.forEach((d, k) => {
        const u = Math.max(0, Math.min(1, (t - d.hitAt) / 0.26));
        if (u > 0 && !d.hit) { d.hit = true; if (click && freezeAt === null) click(k, n); if (freezeAt === null) burst(d, k); }
        d.ang = d.rest * u * u;
      });
      // rings and sparks (world units, so they keep up with the zoom)
      for (const r of rings) {
        r.age += dt; const q = Math.min(1, r.age / 0.6), [x, y] = P(v, r.x, r.z), rr = (r.r0 + (r.r1 - r.r0) * q) * v.s;
        cx.strokeStyle = `rgba(251,191,36,${0.7 * (1 - q)})`; cx.lineWidth = 2;
        cx.beginPath(); cx.ellipse(x, y, rr, rr * TILT, 0, 0, Math.PI * 2); cx.stroke();
      }
      // painter's order: farther (higher on screen) first
      doms.slice().sort((a, b) => a.z - b.z).forEach(d => drawDomino(d, v, t));
      cx.globalCompositeOperation = "lighter";
      for (const p of sparks) {
        p.age += dt; if (p.age > p.life) continue;
        p.vy -= 9.8 * p.size * 0.6 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt);
        const [x, y] = P(v, p.x, p.z, p.y), a = 1 - p.age / p.life;
        cx.fillStyle = `rgba(255,${Math.round(150 + 90 * a)},80,${a})`; cx.beginPath(); cx.arc(x, y, Math.max(1, p.size * v.s * 0.025), 0, 7); cx.fill();
      }
      cx.globalCompositeOperation = "source-over";
      // subtitle at the top while the chain runs
      const sz = Math.min(W, H);
      cx.textAlign = "center"; cx.textBaseline = "alphabetic";
      if (t < titleAt) {
        cx.globalAlpha = Math.min(1, t / 0.4) * (1 - Math.max(0, Math.min(1, (t - boomAt) / 0.3)));
        cx.fillStyle = "#e2e8f0"; cx.font = `600 ${Math.max(15, sz * 0.034)}px "Chakra Petch", Segoe UI, sans-serif`;
        cx.fillText(subtitle, W / 2, H * 0.1); cx.globalAlpha = 1;
      }
      // the finale: the FAILSPAN logo scene - a suspension bridge sags under load while the stress counts up,
      // the deck snaps in the middle (yellow crack, sparks, shake), the halves droop and the name appears
      if (t > boomAt && t < titleAt + 0.35) {
        const f = Math.max(0, 1 - (t - boomAt) / 0.45);
        cx.fillStyle = `rgba(255,237,213,${0.85 * f})`; cx.fillRect(0, 0, W, H);
      }
      if (t > titleAt) drawLogo(t - titleAt);
      if (freezeAt === null && t > endAt) return finish();
      raf = requestAnimationFrame(frame);
    }

    function finish() {
      if (done) return;
      done = true; cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      box.classList.add("out");
      setTimeout(() => box.remove(), 350);
      onDone();
    }
    box.addEventListener("pointerdown", finish);
    window.addEventListener("keydown", function k() { window.removeEventListener("keydown", k); finish(); });
    raf = requestAnimationFrame(frame);
    return finish;
  }

  root.BWIntro = { play };
})(window);
