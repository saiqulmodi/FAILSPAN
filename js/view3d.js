/* FAILSPAN 3D view (Phase 1: scene, camera and the 2D / 3D switch).
 * Loaded only when the player picks 3D, so the 2D game never downloads Three.js.
 * Drag to look around, wheel or pinch to zoom. The bridge, canyon and vehicles arrive in later phases.
 */
import * as THREE from "../vendor/three.module.min.js";

export function create(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x2a1f3d, 60, 220);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  const orbit = { yaw: -0.55, pitch: 0.32, dist: 46, target: new THREE.Vector3(0, 4, 0) };

  // light: warm low sun from one side, cool fill from the other (orange / cyan rim look)
  scene.add(new THREE.HemisphereLight(0x8fb7ff, 0x3a2414, 0.7));
  const sun = new THREE.DirectionalLight(0xffa25a, 1.6);
  sun.position.set(-60, 40, 30); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x38bdf8, 0.45);
  fill.position.set(50, 20, -40); scene.add(fill);

  // ground with a faint build grid, so the empty scene has scale
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x3b2a1e }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const grid = new THREE.GridHelper(80, 40, 0xf59e0b, 0x4b3a2c);
  grid.position.y = 0.02; grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);

  // ---- camera: drag to orbit, wheel / pinch to zoom ----
  const pts = new Map(); let pinch0 = 0, dist0 = 0;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { pinch0 = spread(); dist0 = orbit.dist; } });
  canvas.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    const [x0, y0] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { orbit.yaw -= (e.clientX - x0) * 0.008; orbit.pitch = clamp(orbit.pitch + (e.clientY - y0) * 0.006, 0.05, 1.35); }
    else if (pts.size === 2 && pinch0) orbit.dist = clamp(dist0 * pinch0 / Math.max(1, spread()), 12, 140);
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); orbit.dist = clamp(orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9), 12, 140); }, { passive: false });
  function spread() { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  let W = 0, H = 0, visible = false;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || (r.width === W && r.height === H)) return;
    W = r.width; H = r.height;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  function render() {
    if (!visible) return;
    resize();
    const c = Math.cos(orbit.pitch);
    camera.position.set(orbit.target.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist,
                        orbit.target.z + Math.cos(orbit.yaw) * c * orbit.dist);
    camera.lookAt(orbit.target);
    renderer.render(scene, camera);
  }
  return { setVisible(on) { visible = on; if (on) { W = H = 0; resize(); } }, render, resize };
}

// sunset sky: deep dusk blue at the top to orange at the horizon
function skyTexture() {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#0b1530"); grad.addColorStop(0.55, "#3b2a5c"); grad.addColorStop(0.85, "#f97316"); grad.addColorStop(1, "#fdba74");
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
