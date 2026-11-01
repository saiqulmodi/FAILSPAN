/* FAILSPAN 3D views. Loaded only when the player picks 3D, so the 2D game never downloads Three.js.
 *
 * createBridge(canvas): the class screen. The player's 2D design becomes two side trusses joined by
 *   cross-beams and a road deck, over a sunset canyon. Every frame game.js passes a snapshot (members,
 *   their stress colours / load ratios, the vehicle position, the test status) - the physics is the same
 *   truss solver as 2D, this file only draws it. When a member fails: sparks, debris, the bridge falls,
 *   slow motion, a zoom to the break and camera shake.
 * createWorld(canvas, hooks): the campus road with the 16 class buildings; drag to move, tap a building.
 */
import * as THREE from "../vendor/three.module.min.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const BEAM_T = { S: 0.2, M: 0.28, L: 0.36, XL: 0.46 };
const CABLE_R = { S: 0.05, M: 0.075, L: 0.1, XL: 0.13 };
const GREEN = new THREE.Color("#22c55e"), AMBER = new THREE.Color("#f59e0b"), RED = new THREE.Color("#ef4444");

// ---------------- shared scene pieces ----------------
function makeRenderer(canvas, low) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: "low-power" });
  r.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}
function skyTexture() {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#0b1530"); grad.addColorStop(0.5, "#3b2a5c"); grad.addColorStop(0.8, "#c2410c"); grad.addColorStop(1, "#fdba74");
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0x9bb8ff, 0x4a2a14, 0.75));
  const sun = new THREE.DirectionalLight(0xffa25a, 1.9); sun.position.set(-120, 60, 80); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x38bdf8, 0.55); rim.position.set(100, 30, -90); scene.add(rim);
}
function addSun(scene, at) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffb36b, fog: false }));
  s.position.copy(at); scene.add(s);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 12), new THREE.MeshBasicMaterial({ color: 0xff7a2f, transparent: true, opacity: 0.25, fog: false }));
  halo.position.copy(at); scene.add(halo);
}
function mountains(group, cx, n, r0, r1, zMax = Infinity) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a2f52, flatShading: true });
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd(-0.1, 0.1), r = rnd(r0, r1), h = rnd(25, 70);
    if (Math.sin(a) * r > zMax) continue;   // keep the view to the road clear
    const m = new THREE.Mesh(new THREE.ConeGeometry(rnd(25, 50), h, 5), mat);
    m.position.set(cx + Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r); m.rotation.y = rnd(0, 3); group.add(m);
  }
}
// pointer: one finger / mouse drags, two fingers pinch, wheel zooms. Calls back with deltas.
function pointerControls(canvas, { drag, pinch, wheel, tap }) {
  const pts = new Map(); let spread0 = 0, moved = 0, down = null;
  canvas.style.touchAction = "none";
  const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { moved = 0; down = [e.clientX, e.clientY]; }
    if (pts.size === 2) { spread0 = spread(); moved = 99; if (pinch) pinch(1, true); }
  });
  canvas.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    const [x0, y0] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { moved += Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0); drag(e.clientX - x0, e.clientY - y0); }
    else if (pts.size === 2 && spread0 && pinch) pinch(spread0 / Math.max(1, spread()), false);
  });
  const up = e => {
    if (pts.size === 1 && moved < 8 && tap && down) { const r = canvas.getBoundingClientRect(); tap(e.clientX - r.left, e.clientY - r.top, r); }
    pts.delete(e.pointerId); if (pts.size < 2) spread0 = 0;
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", e => { pts.delete(e.pointerId); });
  canvas.addEventListener("wheel", e => { e.preventDefault(); wheel(e.deltaY || e.deltaX); }, { passive: false });
}
function sizer(renderer, camera, canvas) {
  let W = 0, H = 0;
  return force => {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || (!force && r.width === W && r.height === H)) return false;
    W = r.width; H = r.height; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); return true;
  };
}
function dispose(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && !m.map.shared) m.map.dispose(); m.dispose(); });
  });
}
// a stick (beam or cable) from a to b
function stick(a, b, thick, cable, mat) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length() || 0.01;
  const geo = cable ? new THREE.CylinderGeometry(thick, thick, L, 6) : new THREE.BoxGeometry(thick, L, thick);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return m;
}

// ---------------- vehicle ----------------
function buildVehicle(v) {
  const g = new THREE.Group(), maxOff = Math.max(...v.axles), small = v.mass < 3000;
  const wheelR = small ? 0.36 : 0.5, width = small ? 1.8 : 2.5, col = new THREE.Color(`rgb(${v.colour.join(",")})`);
  const paint = new THREE.MeshStandardMaterial({ color: col, metalness: 0.35, roughness: 0.45 });
  const olive = new THREE.MeshStandardMaterial({ color: v.mass > 50000 ? 0x3f4a2c : 0x4d5a32, metalness: 0.2, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness: 0.6, roughness: 0.15, emissive: 0x0c4a6e, emissiveIntensity: 0.4 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  const box = (w, h, d, mat, x, y, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  const len = maxOff + (small ? 1.9 : 2.6);
  if (small) {   // car
    box(len, 0.7, width, paint, -len / 2 + 1.0, wheelR + 0.35);
    box(len * 0.55, 0.6, width * 0.9, glass, -len / 2 + 0.8, wheelR + 1.0);
  } else {      // cab at the front, cargo behind (crates on a flatbed for trucks, a box for the trailer / convoy)
    box(2.2, 2.3, width, paint, -0.3, wheelR + 1.25);
    box(0.08, 0.9, width * 0.8, glass, 0.82, wheelR + 1.7);
    box(len - 2.4, 0.35, width, dark, -1.4 - (len - 2.4) / 2, wheelR + 0.25);
    const cargoL = len - 2.6;
    if (v.axles.length >= 4) box(cargoL, 2.6, width, olive, -1.5 - cargoL / 2, wheelR + 1.7);
    else for (let k = 0; k < Math.max(2, Math.floor(cargoL / 1.4)); k++) box(1.2, 1.1, width * 0.85, olive, -2.1 - k * 1.4, wheelR + 1.0);
  }
  for (const s of [-1, 1]) { const l = box(0.06, 0.22, 0.32, lamp, small ? 1.0 : 0.82, wheelR + (small ? 0.5 : 0.7), s * width * 0.32); l.userData.lamp = true; }
  const wheels = [];
  for (const off of v.axles) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.42, 14), dark);
    w.rotation.x = Math.PI / 2; w.position.set(-off, wheelR, s * (width / 2 - 0.1)); g.add(w); wheels.push(w);
  }
  g.userData = { wheels, wheelR, len };
  return g;
}

// ================= the bridge view =================
export function createBridge(canvas, opts = {}) {
  let low = !!opts.low;
  const renderer = makeRenderer(canvas, low);
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x3b2a5c, 90, 420);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
  const resize = sizer(renderer, camera, canvas);
  addLights(scene);
  addSun(scene, new THREE.Vector3(-320, 34, -260));

  const orbit = { yaw: -0.5, pitch: 0.2, dist: 50, target: new THREE.Vector3(10, 2, 0), auto: null };
  pointerControls(canvas, {
    drag: (dx, dy) => { orbit.yaw -= dx * 0.008; orbit.pitch = clamp(orbit.pitch + dy * 0.006, -0.25, 1.35); orbit.auto = null; },
    pinch: (f, start) => { if (start) orbit.pd = orbit.dist; else orbit.dist = clamp(orbit.pd * f, 8, 260); },
    wheel: d => { orbit.dist = clamp(orbit.dist * (d > 0 ? 1.1 : 0.9), 8, 260); },
  });

  let terrain = null, terrainSpan = -1, decor = null, bridge = null, vehicle = null, key = "", vehKey = "";
  let parts = [];         // per member: { meshes, mat, a, b, fall, vel, spin, delay, gone }
  let fx = null;          // breaking effects for the current test
  let lastTest = null, lastNow = 0, wasStatus = null, shake = 0, slowUntil = 0;
  let D = 16, W = 6;      // canyon depth, deck width

  // ---------- terrain: two canyon walls, river, road, mountains ----------
  function buildTerrain(span) {
    if (terrain) { scene.remove(terrain); dispose(terrain); }
    if (decor) { scene.remove(decor); dispose(decor); }
    terrain = new THREE.Group(); decor = new THREE.Group(); terrainSpan = span;
    D = Math.max(16, span * 0.42);
    const rockMats = [0x7c3f1d, 0x8a4b22, 0x6b3418, 0x9a5a2c].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
    const topMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1f, roughness: 1 });
    const road = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
    const line = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (const side of [-1, 1]) {
      const edge = side < 0 ? 0 : span, out = side;           // the cliff lies beyond the edge
      const top = new THREE.Mesh(new THREE.BoxGeometry(160, 3, 260), topMat);
      top.position.set(edge + out * 80, -1.5, 0); terrain.add(top);
      const body = new THREE.Mesh(new THREE.BoxGeometry(150, D + 30, 260), rockMats[0]);
      body.position.set(edge + out * 83, -(D + 30) / 2 - 2, 0); terrain.add(body);
      const n = low ? 18 : 46;
      for (let k = 0; k < n; k++) {     // jagged rock face
        const r = rnd(2.5, 6), rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMats[k % 4]);
        rock.position.set(edge + out * (r * 0.95 + rnd(0, 4)), rnd(-D - 2, -2.5), rnd(-45, 45)); rock.rotation.set(rnd(0, 3), rnd(0, 3), 0);
        rock.scale.set(1, rnd(0.8, 1.6), 1); terrain.add(rock);
      }
      const rd = new THREE.Mesh(new THREE.BoxGeometry(70, 0.1, W), road);
      rd.position.set(edge + out * 35.2, 0.02, 0); terrain.add(rd);
      for (let k = 0; k < 9; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.18), line); d.position.set(edge + out * (3 + k * 7), 0.04, 0); terrain.add(d); }
    }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(span + 40, 400),
      new THREE.MeshStandardMaterial({ color: 0x0e5a8a, emissive: 0x0b3954, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.25 }));
    water.rotation.x = -Math.PI / 2; water.position.set(span / 2, -D, 0); water.userData.water = true; terrain.add(water);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(span + 60, 400), new THREE.MeshLambertMaterial({ color: 0x3b2414 }));
    bed.rotation.x = -Math.PI / 2; bed.position.set(span / 2, -D - 0.6, 0); terrain.add(bed);
    mountains(decor, span / 2, low ? 8 : 18, 200, 330);
    if (!low) {                      // floating embers / dust
      const n = 140, pos = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { pos[3 * k] = rnd(-30, span + 30); pos[3 * k + 1] = rnd(-D, 25); pos[3 * k + 2] = rnd(-50, 50); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const em = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa04d, size: 0.35, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      em.userData.embers = true; decor.add(em);
    }
    scene.add(terrain); scene.add(decor);
  }

  // ---------- the bridge from the player's design ----------
  function buildBridge(s) {
    if (bridge) { scene.remove(bridge); dispose(bridge); }
    bridge = new THREE.Group(); parts = [];
    const p = s.project, J = p.joints;
    W = p.span >= 60 ? 8 : 6;
    const z2 = W / 2, sideZ = [-z2, z2];
    const bolt = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.35 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 });
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x222b38, roughness: 0.85 });
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.45 });
    const used = new Set();
    s.members.forEach((m, k) => {
      const [i, j, , size, kind] = m, cable = kind === "cable";
      used.add(i); used.add(j);
      const mat = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, metalness: cable ? 0.4 : 0.7, roughness: 0.4, emissive: 0x000000 });
      const thick = kind === "pylon" ? 1.1 : kind === "deck" ? 0.5 : cable ? CABLE_R[size] || 0.08 : BEAM_T[size] || 0.3;
      const zs = kind === "pylon" ? sideZ.map(z => z + Math.sign(z) * 0.9) : sideZ;
      const meshes = zs.map(z => {
        const ms = stick(new THREE.Vector3(J[i][0], J[i][1], z), new THREE.Vector3(J[j][0], J[j][1], z), thick, cable, mat);
        bridge.add(ms); return ms;
      });
      if (kind === "deck") {        // the road slab across both sides
        const L = Math.hypot(J[j][0] - J[i][0], J[j][1] - J[i][1]);
        const slab = new THREE.Mesh(new THREE.BoxGeometry(L, 0.28, W), asphalt);
        slab.position.set((J[i][0] + J[j][0]) / 2, 0.05, 0); bridge.add(slab); meshes.push(slab);
      }
      const mid = new THREE.Vector3((J[i][0] + J[j][0]) / 2, (J[i][1] + J[j][1]) / 2, 0);
      parts.push({ meshes, mat, mid, kind, i, j, vel: new THREE.Vector3(), spin: new THREE.Vector3(), delay: Infinity, gone: false, col: "" });
    });
    // cross-beams and bolts at every used joint
    for (const k of used) {
      const [x, y] = J[k];
      const cb = stick(new THREE.Vector3(x, y - (y === 0 ? 0.35 : 0), -z2), new THREE.Vector3(x, y - (y === 0 ? 0.35 : 0), z2), y === 0 ? 0.3 : 0.18, false, crossMat);
      bridge.add(cb);
      for (const z of sideZ) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), bolt); b.position.set(x, y, z); bridge.add(b); }
    }
    // supports: a concrete block under ground-level joints, towers up to joints in the air, piers down to the river
    for (const ks in p.supports) {
      const [x, y] = J[+ks];
      for (const z of sideZ) {
        if (y > 0.5) { const t = stick(new THREE.Vector3(x, -2, z + Math.sign(z) * 0.7), new THREE.Vector3(x, y + 0.6, z + Math.sign(z) * 0.7), 1.0, false, concrete); bridge.add(t); }
        else if (y < -0.5) { const t = stick(new THREE.Vector3(x, -D - 1, z + Math.sign(z) * 0.9), new THREE.Vector3(x, y, z + Math.sign(z) * 0.9), 1.8, false, concrete); bridge.add(t); }
        else { const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.4), concrete); b.position.set(x, -0.9, z); bridge.add(b); }
      }
    }
    scene.add(bridge);
  }

  function resetCamera(span) {
    orbit.target.set(span / 2, span * 0.06, 0); orbit.dist = span * 0.78 + 12; orbit.yaw = -0.42; orbit.pitch = 0.16; orbit.auto = null;
  }

  // ---------- breaking effects ----------
  function startBreak(s, now) {
    const p = s.project, J = p.joints, broken = s.failIdx;
    const at = broken !== undefined && broken !== null && parts[broken] ? parts[broken].mid.clone() : new THREE.Vector3(p.span / 2, 0, 0);
    const sup = new Set(Object.keys(p.supports).map(Number));
    parts.forEach((pt, k) => {
      if (pt.kind === "pylon") return;
      const anchored = sup.has(pt.i) && sup.has(pt.j);
      if (anchored && k !== broken) return;
      pt.delay = k === broken ? 0 : 0.12 + pt.mid.distanceTo(at) / 14 + rnd(0, 0.15);
      pt.vel.set(rnd(-1.5, 1.5), k === broken ? rnd(1, 3) : rnd(-0.5, 0.8), rnd(-1.2, 1.2));
      pt.spin.set(rnd(-1.5, 1.5), rnd(-0.5, 0.5), rnd(-2, 2));
    });
    // sparks
    const n = low ? 70 : 220, pos = new Float32Array(n * 3), vel = [];
    for (let k = 0; k < n; k++) {
      pos[3 * k] = at.x; pos[3 * k + 1] = at.y; pos[3 * k + 2] = rnd(-W / 2, W / 2);
      vel.push(new THREE.Vector3(rnd(-9, 9), rnd(-2, 12), rnd(-9, 9)));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffc46b, size: low ? 0.5 : 0.35, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(sparks);
    // debris chunks
    const debris = [], dm = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.5 });
    for (let k = 0; k < (low ? 8 : 26); k++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.15, 0.5), rnd(0.1, 0.35), rnd(0.15, 0.5)), dm);
      c.position.set(at.x + rnd(-0.6, 0.6), at.y, rnd(-W / 2, W / 2)); scene.add(c);
      debris.push({ m: c, v: new THREE.Vector3(rnd(-6, 6), rnd(1, 9), rnd(-6, 6)), s: new THREE.Vector3(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)) });
    }
    // a hot flash at the break
    const flash = new THREE.PointLight(0xff5a1f, 60, 40, 1.6); flash.position.copy(at).add(new THREE.Vector3(0, 1, 0)); scene.add(flash);
    fx = { t: 0, at, sparks, vel, debris, flash, carFall: s.vx !== null && s.vx !== undefined };
    slowUntil = now + 1700; shake = 1;
    orbit.auto = { target: at.clone(), dist: clamp(p.span * 0.45 + 10, 14, 50) };
  }
  function clearFx() {
    if (!fx) return;
    scene.remove(fx.sparks); dispose(fx.sparks); scene.remove(fx.flash);
    for (const d of fx.debris) { scene.remove(d.m); d.m.geometry.dispose(); }
    fx = null;
  }
  function stepFx(dt) {
    if (!fx) return;
    fx.t += dt;
    const g = 9.8;
    const pos = fx.sparks.geometry.attributes.position;
    for (let k = 0; k < fx.vel.length; k++) {
      const v = fx.vel[k]; v.y -= g * dt;
      pos.array[3 * k] += v.x * dt; pos.array[3 * k + 1] += v.y * dt; pos.array[3 * k + 2] += v.z * dt;
    }
    pos.needsUpdate = true;
    fx.sparks.material.opacity = Math.max(0, 1 - fx.t / 2.2);
    fx.flash.intensity = Math.max(0, 60 * (1 - fx.t / 0.8));
    for (const d of fx.debris) {
      if (d.m.position.y < -D) continue;
      d.v.y -= g * dt; d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.s.x * dt; d.m.rotation.y += d.s.y * dt; d.m.rotation.z += d.s.z * dt;
    }
    for (const pt of parts) {
      if (fx.t < pt.delay || pt.gone) continue;
      pt.vel.y -= g * dt;
      for (const m of pt.meshes) {
        m.position.addScaledVector(pt.vel, dt);
        m.rotation.x += pt.spin.x * dt * 0.4; m.rotation.z += pt.spin.z * dt * 0.4;
        if (m.position.y < -D - 2) pt.gone = true;
      }
    }
    if (vehicle && fx.carFall && fx.t > 0.25) {
      const u = vehicle.userData; u.fallV = (u.fallV || 0) + g * dt;
      if (vehicle.position.y > -D + 1) { vehicle.position.y -= u.fallV * dt; vehicle.rotation.z = Math.max(-1.1, vehicle.rotation.z - dt * 0.9); }
    }
  }

  // ---------- each frame ----------
  let visible = false;
  function render(now, s) {
    if (!visible) return;
    resize();
    const realDt = Math.min(0.1, lastNow ? (now - lastNow) / 1000 : 0); lastNow = now;
    const dt = realDt * (now < slowUntil ? 0.25 : 1);
    if (s) {
      if (s.project.span !== terrainSpan) { buildTerrain(s.project.span); resetCamera(s.project.span); }
      const vk = s.project.id + ":" + s.project.vehicle.name;
      if (vk !== vehKey) { if (vehicle) { scene.remove(vehicle); dispose(vehicle); } vehicle = buildVehicle(s.project.vehicle); scene.add(vehicle); vehKey = vk; }
      // a new test, or a changed design, rebuilds the bridge (cheap: tens of meshes)
      if (s.key !== key || s.testId !== lastTest) {
        clearFx(); buildBridge(s); key = s.key; lastTest = s.testId; wasStatus = s.status;
        vehicle.rotation.z = 0; vehicle.userData.fallV = 0; orbit.auto = null;
      }
      if (s.status === "failed" && wasStatus !== "failed") startBreak(s, now);
      wasStatus = s.status;
      // colours: material colour before a test; the stress glow during and after it
      parts.forEach((pt, k) => {
        const r = s.ratios ? s.ratios[k] : null;
        if (r === null || r === undefined) {
          if (pt.col !== s.colours[k]) { pt.mat.color.set(s.colours[k]); pt.mat.emissive.setRGB(0, 0, 0); pt.col = s.colours[k]; }
          return;
        }
        pt.col = "";
        const c = r < 0.5 ? GREEN.clone().lerp(AMBER, r / 0.5) : AMBER.clone().lerp(RED, clamp((r - 0.5) / 0.5, 0, 1));
        if (s.slack && s.slack[k]) c.set("#64748b");
        pt.mat.color.copy(c);
        const pulse = r >= 0.8 ? 0.55 + 0.45 * Math.sin(now / 70) : 1;
        pt.mat.emissive.copy(c).multiplyScalar(clamp((r - 0.3) * 1.4, 0.08, 1.2) * pulse);
        if (k === s.failIdx && s.status === "failed") pt.mat.emissive.set("#ff2d55");
      });
      // vehicle: drives with the test, waits on the left bank otherwise
      if (!fx || !fx.carFall) {
        const x = s.vx === null || s.vx === undefined ? -2 : s.vx;
        const u = vehicle.userData, prev = vehicle.position.x;
        vehicle.position.set(x, 0.2, 0);
        for (const w of u.wheels) w.rotation.y -= (x - prev) / u.wheelR;
        // a little sag under the wheels when the bridge is loaded hard
        vehicle.rotation.z = s.worstNow > 0.8 ? Math.sin(now / 60) * 0.01 : 0;
      }
    }
    stepFx(dt);
    // decoration motion
    if (decor && !low) decor.children.forEach(o => { if (o.userData.embers) o.rotation.y += realDt * 0.01; });
    // camera
    if (orbit.auto) { orbit.target.lerp(orbit.auto.target, 1 - Math.pow(0.02, realDt)); orbit.dist += (orbit.auto.dist - orbit.dist) * (1 - Math.pow(0.05, realDt)); }
    const c = Math.cos(orbit.pitch);
    camera.position.set(orbit.target.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist,
                        orbit.target.z + Math.cos(orbit.yaw) * c * orbit.dist);
    camera.lookAt(orbit.target);
    if (shake > 0.01) { camera.position.x += rnd(-1, 1) * shake * 0.6; camera.position.y += rnd(-1, 1) * shake * 0.6; shake *= Math.pow(0.15, realDt); }
    renderer.render(scene, camera);
  }
  return {
    setVisible(on) { visible = on; if (on) { resize(true); lastNow = 0; } },
    render,
    resetCamera() { if (terrainSpan > 0) resetCamera(terrainSpan); },
    slowMo: () => performance.now() < slowUntil,
  };
}

// ================= the campus road =================
// slots come from the 2D layout (pixels); 10 px = 1 m here.
export function createWorld(canvas, hooks) {
  const low = !!hooks.low;
  const renderer = makeRenderer(canvas, low);
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x3b2a5c, 80, 380);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1500);
  const resize = sizer(renderer, camera, canvas);
  addLights(scene);
  let built = false, key = "", world = null, buildings = [], cars = [], labelGroup = null;
  const S = 0.1;

  pointerControls(canvas, {
    drag: dx => hooks.pan(-dx * 1.6),
    wheel: d => hooks.pan(d),
    tap: (x, y, r) => {
      const ray = new THREE.Raycaster(), v = new THREE.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
      ray.setFromCamera(v, camera);
      const hit = ray.intersectObjects(buildings.map(b => b.mesh), false)[0];
      if (hit) hooks.pick(hit.object.userData.level);
    },
  });

  function windowsTexture() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#1e293b"; g.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 124; y += 14) for (let x = 6; x < 60; x += 14) { g.fillStyle = Math.random() < 0.75 ? "#fde68a" : "#334155"; g.fillRect(x, y, 8, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.shared = true; return t;
  }
  function label(text, sub, colour) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 160; const g = c.getContext("2d");
    g.fillStyle = "rgba(15,23,42,.78)"; g.strokeStyle = colour; g.lineWidth = 6;
    g.beginPath(); g.roundRect(6, 6, 500, 148, 22); g.fill(); g.stroke();
    g.fillStyle = "#f1f5f9"; g.textAlign = "center"; g.font = "bold 54px 'Chakra Petch', 'Segoe UI', sans-serif"; g.fillText(text, 256, 72, 480);
    g.fillStyle = "#facc15"; g.font = "40px 'Segoe UI', sans-serif"; g.fillText(sub, 256, 128, 480);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false }));
    sp.scale.set(12, 3.75, 1); sp.renderOrder = 5; return sp;
  }

  function build(w) {
    if (world) { scene.remove(world); dispose(world); }
    world = new THREE.Group(); buildings = []; cars = [];
    const len = w.width * S;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(len + 400, 400), new THREE.MeshLambertMaterial({ color: 0x3d5a2a }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(len / 2, 0, 0); world.add(ground);
    const road = new THREE.Mesh(new THREE.BoxGeometry(len + 60, 0.1, 9), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 }));
    road.position.set(len / 2, 0.05, 6); world.add(road);
    const dash = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let x = -20; x < len + 20; x += 6) { const d = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.25), dash); d.position.set(x, 0.12, 6); world.add(d); }
    // rivers where the bridge project changes, each with a little truss bridge
    const water = new THREE.MeshStandardMaterial({ color: 0x0e5a8a, emissive: 0x0b3954, emissiveIntensity: 0.6, roughness: 0.3 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.4 });
    for (let k = 1; k < w.slots.length; k++) {
      const a = w.slots[k - 1], b = w.slots[k];
      if (a.project === b.project) continue;
      const x0 = (a.x + a.w) * S + 4, x1 = b.x * S - 4, cx = (x0 + x1) / 2, rw = Math.max(6, x1 - x0);
      const river = new THREE.Mesh(new THREE.PlaneGeometry(rw, 400), water); river.rotation.x = -Math.PI / 2; river.position.set(cx, 0.06, 0); world.add(river);
      for (const z of [1.5, 10.5]) {
        world.add(stick(new THREE.Vector3(cx - rw / 2, 0.3, z), new THREE.Vector3(cx + rw / 2, 0.3, z), 0.3, false, steel));
        for (let i = 0; i < 4; i++) {
          const xa = cx - rw / 2 + (rw / 4) * i, xb = xa + rw / 4;
          world.add(stick(new THREE.Vector3(xa, 0.3, z), new THREE.Vector3(xb, 2.6, z), 0.2, false, steel));
          world.add(stick(new THREE.Vector3(xa, 2.6, z), new THREE.Vector3(xb, 2.6, z), 0.2, false, steel));
          world.add(stick(new THREE.Vector3(xb, 2.6, z), new THREE.Vector3(xb, 0.3, z), 0.2, false, steel));
        }
      }
    }
    const win = windowsTexture();
    w.slots.forEach((s, k) => {
      const cx = (s.x + s.w / 2) * S, h = 8 + k * 0.9, bw = s.w * S;
      const zone = new THREE.Color(s.zone);
      const walls = new THREE.MeshStandardMaterial({ color: zone.clone().lerp(new THREE.Color(0x94a3b8), 0.35), roughness: 0.7, map: win, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: s.locked ? 0.05 : 0.45 });
      const roofMat = new THREE.MeshStandardMaterial({ color: s.done ? 0xfacc15 : zone, metalness: 0.3, roughness: 0.5, emissive: s.done ? 0xb45309 : 0x000000, emissiveIntensity: 0.5 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, h, 10), walls);
      m.position.set(cx, h / 2, -8); m.userData.level = s.level; world.add(m);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.62, 3.2, 4), roofMat); roof.rotation.y = Math.PI / 4;
      roof.position.set(cx, h + 1.6, -8); roof.userData.level = s.level; world.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(3, 3.6, 0.3), new THREE.MeshBasicMaterial({ color: s.locked ? 0x475569 : 0xfde68a }));
      door.position.set(cx, 1.8, -2.9); world.add(door);
      const lb = label((s.locked ? "🔒 " : "") + s.name, s.sub, s.done ? "#4ade80" : s.locked ? "#64748b" : "#38bdf8");
      lb.position.set(cx, h + 6, -8); world.add(lb);
      buildings.push({ mesh: m, level: s.level }, { mesh: roof, level: s.level });
    });
    // trees
    const leaf = new THREE.MeshLambertMaterial({ color: 0x2f6b2a, flatShading: true }), trunk = new THREE.MeshLambertMaterial({ color: 0x5b3a1f });
    for (let x = -30; x < len + 30; x += low ? 14 : 7) {
      for (const z of [15, -20]) {
        if (Math.random() < 0.35) continue;
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 5), trunk); tr.position.set(x + rnd(-2, 2), 1, z + rnd(-2, 2)); world.add(tr);
        const lf = new THREE.Mesh(new THREE.ConeGeometry(rnd(1.6, 2.4), rnd(3.5, 5), 6), leaf); lf.position.set(tr.position.x, 4, tr.position.z); world.add(lf);
      }
    }
    // a few cars on the road
    const cols = [0xfacc15, 0xf472b6, 0x60a5fa, 0x4ade80, 0xfb923c];
    for (let k = 0; k < (low ? 4 : 10); k++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 1.8), new THREE.MeshStandardMaterial({ color: cols[k % 5], metalness: 0.4, roughness: 0.4 }));
      car.position.set(rnd(0, len), 0.75, k % 2 ? 4 : 8); car.userData.v = (k % 2 ? -1 : 1) * rnd(6, 11); world.add(car); cars.push(car);
    }
    mountains(world, len / 2, low ? 10 : 22, 220, 360, -90);
    addSun(world, new THREE.Vector3(len / 2 - 200, 30, -330));
    scene.add(world); built = true;
    world.userData.len = len;
  }

  let visible = false, lastNow = 0, camX = null;
  function render(now, w) {
    if (!visible || !w) return;
    resize();
    const dt = Math.min(0.1, lastNow ? (now - lastNow) / 1000 : 0); lastNow = now;
    if (!built || w.key !== key) { build(w); key = w.key; }
    const len = world.userData.len;
    for (const c of cars) { c.position.x += c.userData.v * dt; if (c.position.x > len + 20) c.position.x = -20; if (c.position.x < -20) c.position.x = len + 20; }
    const want = w.center * S;
    camX = camX === null ? want : camX + (want - camX) * (1 - Math.pow(0.001, dt));
    camera.position.set(camX, 20, 42); camera.lookAt(camX, 5, -6);
    renderer.render(scene, camera);
  }
  return { setVisible(on) { visible = on; if (on) { resize(true); lastNow = 0; } }, render };
}
