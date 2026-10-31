/* Opening theme: "the way to your destination".
 * A chain of dominoes, one per step of the journey (Class 1 ... Expert Engineer), each smaller than the
 * last, topples one after another towards the destination; the last one is almost zero size, then
 * the whole chain shrinks into that point and the game starts. Tap or Skip ends it at once.
 */
(function (root) {
  "use strict";
  const RATIO = 0.82;          // each domino is 82% of the one before
  const STEP = 0.15;           // seconds between one domino being hit and the next

  // freezeAt (seconds) holds one moment on screen - used to check frames and make the store thumbnail
  function play({ labels, title, subtitle, skipText, click, onDone, freezeAt = null }) {
    const box = document.createElement("div");
    box.id = "intro";
    box.innerHTML = `<canvas></canvas><button class="skip">${skipText}</button>`;
    document.body.appendChild(box);
    const cv = box.querySelector("canvas"), cx = cv.getContext("2d");
    let W = 0, H = 0, done = false, start = 0, raf = 0;

    function resize() {
      const d = window.devicePixelRatio || 1;
      W = innerWidth; H = innerHeight;
      cv.width = W * d; cv.height = H * d; cv.style.width = W + "px"; cv.style.height = H + "px";
      cx.setTransform(d, 0, 0, d, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // dominoes in "world" units: the first is 1 tall; each next is RATIO times smaller and placed so the
    // falling one's top lands on it. The chain rises gently, like a road going away to the horizon.
    const n = labels.length, doms = [];
    let x = 0, y = 0;
    for (let k = 0; k < n; k++) {
      const h = Math.pow(RATIO, k), w = h * 0.42;
      doms.push({ x, y, h, w, label: labels[k], hitAt: k * STEP, ang: 0 });
      x += w + h * 0.55; y -= h * 0.18;
    }
    const end = { x: x, y: y };
    const total = n * STEP + 0.55, zoomTime = 0.7, titleTime = 0.6;

    function layout() {
      // fit the chain into the screen (portrait phones too)
      const minY = Math.min(...doms.map(d => d.y - d.h)), maxX = end.x;
      const s = Math.min((W * 0.86) / maxX, (H * 0.62) / (doms[0].y - minY + 0.1));
      return { s, ox: (W - maxX * s) / 2, oy: H * 0.72 };
    }

    function drawDomino(d, v, alpha) {
      const bx = v.ox + d.x * v.s, by = v.oy + d.y * v.s, w = d.w * v.s, h = d.h * v.s;
      cx.save();
      cx.globalAlpha = alpha;
      cx.translate(bx + w, by);                // falls forward around its front-bottom corner
      cx.rotate(d.ang);
      cx.translate(-w, 0);
      const r = Math.max(1, w * 0.12);
      cx.fillStyle = "rgba(0,0,0,.35)"; roundRect(w * 0.08, -h + w * 0.08, w, h, r); cx.fill();
      const g = cx.createLinearGradient(0, -h, w, 0);
      g.addColorStop(0, "#f8fafc"); g.addColorStop(1, "#cbd5e1");
      cx.fillStyle = g; roundRect(0, -h, w, h, r); cx.fill();
      cx.strokeStyle = "#0f172a"; cx.lineWidth = Math.max(1, w * 0.05); cx.stroke();
      if (h > 14) {
        cx.save(); cx.translate(w / 2, -h * 0.5); cx.rotate(-Math.PI / 2);
        const fs = Math.min(w * 0.5, h * 0.9 / Math.max(4, d.label.length * 0.62));
        cx.font = `bold ${fs}px Segoe UI, system-ui, sans-serif`; cx.textAlign = "center"; cx.textBaseline = "middle";
        cx.fillStyle = "#0b1120"; cx.fillText(d.label, 0, -w * 0.18, h * 0.8);
        cx.restore();
      }
      cx.restore();
    }
    function roundRect(x, y, w, h, r) {
      cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
      cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
    }

    function frame(now) {
      if (done) return;
      if (!start) start = now;
      const t = freezeAt !== null ? freezeAt : (now - start) / 1000, v = layout();
      cx.fillStyle = "#0b1120"; cx.fillRect(0, 0, W, H);
      // the road to the destination
      cx.strokeStyle = "rgba(250,204,21,.35)"; cx.lineWidth = 2; cx.setLineDash([10, 10]);
      cx.beginPath(); cx.moveTo(v.ox - 20, v.oy + 6); cx.lineTo(v.ox + end.x * v.s, v.oy + end.y * v.s + 4); cx.stroke(); cx.setLineDash([]);
      // fall: each domino starts when hit, tips over in 0.22 s with gravity-like easing and leans on the next one;
      // the last one, with nothing in front, falls flat
      doms.forEach((d, k) => {
        const u = Math.max(0, Math.min(1, (t - d.hitAt) / 0.22));
        const was = d.ang;
        d.ang = (k === n - 1 ? 1.5 : 0.78) * u * u;
        if (was === 0 && d.ang > 0 && click && freezeAt === null) click(k, n);
      });
      // after the last one falls, everything shrinks into the destination point
      const z = Math.max(0, Math.min(1, (t - total) / zoomTime));
      const ez = z * z * (3 - 2 * z), sc = 1 - ez * 0.985;
      const fx = v.ox + end.x * v.s, fy = v.oy + end.y * v.s;
      cx.save(); cx.translate(fx, fy); cx.scale(sc, sc); cx.translate(-fx, -fy);
      doms.forEach(d => drawDomino(d, v, 1));
      cx.restore();
      // destination glow
      const pulse = 4 + 3 * Math.sin(t * 8);
      cx.fillStyle = "rgba(250,204,21,.85)"; cx.beginPath(); cx.arc(fx, fy - 2, 3 + pulse * (1 - z), 0, 7); cx.fill();
      // words
      cx.textAlign = "center"; cx.fillStyle = "#e2e8f0";
      cx.font = `600 ${Math.max(15, Math.min(W, H) * 0.035)}px Segoe UI, system-ui, sans-serif`;
      cx.globalAlpha = 1 - z; cx.fillText(subtitle, W / 2, H * 0.14); cx.globalAlpha = 1;
      if (z > 0) {
        cx.globalAlpha = Math.min(1, z * 1.5);
        cx.font = `bold ${Math.max(26, Math.min(W, H) * 0.08)}px Segoe UI, system-ui, sans-serif`;
        cx.fillStyle = "#f8fafc"; cx.fillText(title, W / 2, H * 0.5);
        cx.globalAlpha = 1;
      }
      if (freezeAt === null && t > total + zoomTime + titleTime) return finish();
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
