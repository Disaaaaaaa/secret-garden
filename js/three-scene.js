/*
  three-scene.js — the 3D Secret Garden (Three.js).

  Everything is built from simple shapes in code, so no heavy 3D files
  have to be downloaded. The garden has 6 restoration stages (0 → 5):
    0 dark and grey · 1 grass · 2 flowers · 3 leafy trees · 4 birds · 5 fully restored
*/
import * as THREE from 'three';
import { tween, motion } from './animations.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const lerp = (a, b, t) => a + (b - a) * t;

// Seeded random → the garden looks the same every time it loads
let SEED = 20240611;
const srand = () => { SEED = (SEED * 16807) % 2147483647; return (SEED - 1) / 2147483646; };
const sr = (a, b) => a + srand() * (b - a);
const pick = list => list[Math.floor(srand() * list.length)];

/* Map locations: where each object is, where the camera goes, where the pin floats */
export const LOCATIONS = {
  gardenGate:    { pos: V(0, 0, 16.4),    pinY: 7.0, cam: V(0, 4.4, 7),      look: V(0, 3, 18),      ring: 1.9 },
  oldTree:       { pos: V(-11, 0, 6),     pinY: 9.6, cam: V(-3.6, 4.6, 15),  look: V(-11, 2.6, 5.2), ring: 2.5 },
  roseGarden:    { pos: V(11, 0, 6),      pinY: 4.0, cam: V(4.6, 4.8, 14.5), look: V(11, 1.3, 5.4),  ring: 3.3 },
  colinsWindow:  { pos: V(-6, 10.5, -26.4), pinY: 2.3, cam: V(-4.4, 8.6, -7.5), look: V(-6, 10.2, -26.5), ring: 0 },
  fountain:      { pos: V(0, 0, 2),       pinY: 4.8, cam: V(0, 6, 13),       look: V(0, 1, 1.8),     ring: 3.5 },
  hiddenBench:   { pos: V(-13, 0, -11),   pinY: 4.6, cam: V(-6.6, 4.4, -2.4), look: V(-12.6, 1.2, -10.6), ring: 2.6 },
  digitalPortal: { pos: V(13, 0, -11),    pinY: 7.2, cam: V(8.2, 4.2, -1.2), look: V(13, 3, -11),    ring: 3.0 },
  finalGarden:   { pos: V(0, 0, -14),     pinY: 6.2, cam: V(0, 4.6, -3.5),   look: V(0, 2.6, -14),   ring: 3.2 }
};

const PALETTES = {
  landing: { top: '#9db6b4', bottom: '#f0dfbb', fog: '#d8cdae', sun: '#ffe2b0', sunI: 2.5, sky: '#e3ead6', ground: '#4f5b36', hemiI: 1.05, near: 30, far: 125 },
  gloom:   { top: '#7c8984', bottom: '#bdb7a4', fog: '#a9a594', sun: '#e6d6b8', sunI: 1.15, sky: '#b8beb2', ground: '#4a4a3a', hemiI: 0.8, near: 22, far: 95 },
  bloom:   { top: '#8db4c6', bottom: '#f5e7c4', fog: '#e4dbbd', sun: '#fff0c8', sunI: 2.8, sky: '#e8f0dc', ground: '#556b35', hemiI: 1.15, near: 45, far: 160 },
  digital: { top: '#1c3536', bottom: '#41615f', fog: '#2b4a4a', sun: '#c5dcd5', sunI: 1.0, sky: '#9ec7c0', ground: '#2a3a35', hemiI: 0.95, near: 20, far: 90 },
  final:   { top: '#86b3c9', bottom: '#fbe5b6', fog: '#efdeb8', sun: '#ffe9b8', sunI: 3.1, sky: '#f1f4dc', ground: '#5c7236', hemiI: 1.25, near: 50, far: 175 }
};

/* ---------- Canvas textures (no image files needed) ---------- */
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const noiseTex = repeat => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const v = Math.random() < 0.5 ? 255 : 120;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.09})`;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 0, Math.PI * 2);
    g.fill();
  }
}, repeat);

const brickTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#9b927f'; g.fillRect(0, 0, w, h);
  const rows = 8, rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -24 : 0;
    while (x < w) {
      const bw = 40 + Math.random() * 30;
      const tone = 185 + Math.random() * 40;
      g.fillStyle = `rgb(${tone},${tone - 8},${tone - 22})`;
      g.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4);
      g.fillStyle = 'rgba(80,90,60,0.18)';
      if (Math.random() < 0.35) g.fillRect(x + 2, r * rh + rh * 0.6, bw - 4, rh * 0.4 - 2);
      x += bw;
    }
  }
}, [1, 1]);

const plankTex = () => canvasTex(128, 256, (g, w, h) => {
  const pw = w / 4;
  for (let i = 0; i < 4; i++) {
    const tone = 120 + Math.random() * 25;
    g.fillStyle = `rgb(${tone},${tone * 0.72},${tone * 0.48})`;
    g.fillRect(i * pw, 0, pw, h);
    g.strokeStyle = 'rgba(40,25,15,.5)'; g.lineWidth = 2;
    g.strokeRect(i * pw, 0, pw, h);
    g.strokeStyle = 'rgba(40,25,15,.15)'; g.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      const x = i * pw + 4 + Math.random() * (pw - 8);
      g.moveTo(x, 0); g.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.6, x + 2, h); g.stroke();
    }
  }
});

const radialTex = (inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') => canvasTex(128, 128, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

const shaftTex = () => canvasTex(32, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(255,240,200,0)');
  grd.addColorStop(0.35, 'rgba(255,240,200,.85)');
  grd.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side; g.fillRect(0, 0, w, h);
});

const pageTex = () => canvasTex(96, 128, (g, w, h) => {
  g.fillStyle = '#f4ead2'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b8a27a'; g.lineWidth = 2;
  for (let y = 22; y < h - 12; y += 11) { g.beginPath(); g.moveTo(10, y); g.lineTo(w - 10 - Math.random() * 18, y); g.stroke(); }
  g.fillStyle = '#c97a86'; g.beginPath(); g.arc(w - 18, 14, 6, 0, Math.PI * 2); g.fill();
});

function iconTex(kind) {
  return canvasTex(128, 128, (g, w) => {
    const r = 22;
    g.fillStyle = kind === 'card' ? '#f3efe6' : 'rgba(247,240,225,.95)';
    g.beginPath();
    g.roundRect ? g.roundRect(8, 14, w - 16, w - 40, r) : g.rect(8, 14, w - 16, w - 40);
    g.fill();
    if (kind !== 'card') { g.beginPath(); g.moveTo(30, w - 28); g.lineTo(26, w - 8); g.lineTo(50, w - 28); g.fill(); }
    g.lineWidth = 6; g.lineCap = 'round';
    if (kind === 'dots') {
      g.fillStyle = '#5f8f84';
      [40, 64, 88].forEach(x => { g.beginPath(); g.arc(x, 55, 8, 0, Math.PI * 2); g.fill(); });
    } else if (kind === 'heart') {
      g.fillStyle = '#b54d66';
      g.beginPath(); g.moveTo(64, 82);
      g.bezierCurveTo(20, 54, 40, 22, 64, 42); g.bezierCurveTo(88, 22, 108, 54, 64, 82); g.fill();
    } else if (kind === 'bell') {
      g.fillStyle = '#c99a2e';
      g.beginPath(); g.moveTo(40, 78); g.quadraticCurveTo(44, 30, 64, 30); g.quadraticCurveTo(84, 30, 88, 78); g.closePath(); g.fill();
      g.beginPath(); g.arc(64, 82, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b54d66'; g.beginPath(); g.arc(92, 32, 12, 0, Math.PI * 2); g.fill();
    } else if (kind === 'mail') {
      g.strokeStyle = '#2f4a44'; g.strokeRect(30, 34, 68, 44);
      g.beginPath(); g.moveTo(30, 34); g.lineTo(64, 60); g.lineTo(98, 34); g.stroke();
    } else if (kind === 'card') {
      g.fillStyle = '#9cae8c'; g.beginPath(); g.arc(34, 40, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9c2b2';
      g.fillRect(54, 32, 50, 7); g.fillRect(54, 44, 34, 6);
      g.fillStyle = '#d9cfbb'; g.fillRect(20, 60, 88, 22);
    }
  });
}

/** Make a box's texture tile by its real size (so bricks are not stretched). */
function scaleBoxUV(geo, w, h, d, unit = 2.2) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / unit, uv.getY(i) * dims[f][1] / unit);
    }
  }
  uv.needsUpdate = true;
}

/* ============================================================== */
class GardenWorld {
  constructor(container, opts = {}) {
    this.container = container;
    const mobile = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600;
    this.low = opts.quality === 'low' || (opts.quality !== 'high' && mobile);
    this.is3D = true;
    this.mode = 'landing';
    this.stageValue = 0;
    this._appliedStage = -1;
    this.finalBoost = 0;
    this.locStates = {};
    this.hover = null;
    this.paused = false;
    this.listeners = {};
    this.collectibles = {};
    this.keyHunt = null;
    this.hitTargets = [];
    this.characters = {};
    this.bursts = [];
    this.plants = [];
    this.time = 0;
  }

  on(evt, fn) { this.listeners[evt] = fn; }
  emit(evt, ...args) { this.listeners[evt]?.(...args); }

  async build(onProgress = () => {}) {
    const step = async (p, fn) => { fn(); onProgress(p); await new Promise(r => setTimeout(r, 0)); };

    await step(0.05, () => this._initRenderer());
    await step(0.15, () => this._buildSky());
    await step(0.25, () => this._buildGround());
    await step(0.38, () => this._buildWalls());
    await step(0.48, () => this._buildGate());
    await step(0.55, () => this._buildManor());
    await step(0.65, () => this._buildTrees());
    await step(0.72, () => this._buildGardenObjects());
    await step(0.82, () => this._buildFlora());
    await step(0.9, () => this._buildLife());
    await step(0.95, () => this._buildCharacters());
    await step(0.98, () => this._buildCollectibles());
    this._applyStage(0, true);
    this._setPaletteInstant('landing');
    this._applyCameraView(this.landingView());
    this._bindPointer();
    this._loop();
    onProgress(1);
  }

  /* ---------- renderer & scene ---------- */
  _initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: !this.low, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1.25 : 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = !this.low;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(r.domElement);
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#d8cdae', 30, 125);
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 450);
    this.camBase = V(0, 2.5, 33);
    this.lookBase = V(0, 3.4, 18);
    this.clock = new THREE.Clock();

    this.hemi = new THREE.HemisphereLight('#e3ead6', '#4f5b36', 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffe2b0', 2.5);
    this.sun.position.set(-22, 34, 26);
    if (!this.low) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const s = this.sun.shadow.camera;
      s.left = -34; s.right = 34; s.top = 34; s.bottom = -34; s.near = 5; s.far = 110;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.03;
    }
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.palette = {};
    for (const k of ['top', 'bottom', 'fog', 'sun', 'sky', 'ground']) this.palette[k] = new THREE.Color();
    this.palette.sunI = 2; this.palette.hemiI = 1; this.palette.near = 30; this.palette.far = 120;
    this.paletteTarget = null;

    this.texRadial = radialTex();
    this.mats = {
      stone: new THREE.MeshStandardMaterial({ color: '#b7ad9a', roughness: 0.95 }),
      darkStone: new THREE.MeshStandardMaterial({ color: '#8d8573', roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ color: '#7a5a40', roughness: 0.85 }),
      iron: new THREE.MeshStandardMaterial({ color: '#2f2b26', roughness: 0.6, metalness: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d8b56a', roughness: 0.3, metalness: 0.85, emissive: '#5a4310', emissiveIntensity: 0.4 }),
      leafOuter: new THREE.MeshStandardMaterial({ color: '#4d7a3a', roughness: 0.9, flatShading: true }),
      canopyInner: new THREE.MeshStandardMaterial({ color: '#6f6655', roughness: 0.95, flatShading: true }),
      bushInner: new THREE.MeshStandardMaterial({ color: '#5e5a48', roughness: 0.95, flatShading: true }),
      bark: new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 1 }),
      soil: new THREE.MeshStandardMaterial({ color: '#5b4330', roughness: 1 })
    };

    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.mode === 'hub' && this._atOverview) this._applyCameraView(this.overviewView());
  }

  _buildSky() {
    this.skyUniforms = { top: { value: new THREE.Color('#9db6b4') }, bottom: { value: new THREE.Color('#f0dfbb') } };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; float t = pow(clamp(h*1.4+0.08,0.0,1.0), 0.75); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }'
      })
    );
    sky.renderOrder = -1;
    this.scene.add(sky);
  }

  _buildGround() {
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 340),
      new THREE.MeshStandardMaterial({ color: '#61804a', map: noiseTex([46, 46]), roughness: 1 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.receiveShadow = true;
    this.scene.add(outer);

    this.innerGroundMat = new THREE.MeshStandardMaterial({ color: '#6e6450', map: noiseTex([7, 7]), roughness: 1 });
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(40, 38), this.innerGroundMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(0, 0.02, -1);
    inner.receiveShadow = true;
    this.scene.add(inner);

    // stone stepping paths
    const segs = [
      [[0, 42], [0, 19]], [[0, 17.2], [0, 5.6]], [[0, -1.6], [0, -10.8]],
      [[-3, 3.4], [-8.6, 5.6]], [[3, 3.4], [8.2, 5.6]],
      [[-2.6, -0.6], [-11, -9]], [[2.6, -0.6], [11, -9]]
    ];
    const pts = [];
    for (const [[x1, z1], [x2, z2]] of segs) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.floor(len / 1.15);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push([lerp(x1, x2, t) + sr(-0.2, 0.2), lerp(z1, z2, t) + sr(-0.2, 0.2), sr(0.42, 0.62), sr(0, 6)]);
      }
    }
    const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.12, 7), new THREE.MeshStandardMaterial({ color: '#a69d8c', roughness: 0.95 }), pts.length);
    const d = new THREE.Object3D();
    pts.forEach(([x, z, r, rot], i) => {
      d.position.set(x, 0.05, z); d.rotation.set(0, rot, 0); d.scale.set(r, 1, r * sr(0.8, 1));
      d.updateMatrix(); stones.setMatrixAt(i, d.matrix);
    });
    stones.receiveShadow = true;
    this.scene.add(stones);
  }

  _buildWalls() {
    const tex = brickTex();
    const wallMat = new THREE.MeshStandardMaterial({ map: tex, color: '#c9bfac', roughness: 0.95 });
    this.mats.wall = wallMat;
    const H = 4.4, T = 0.9;
    const walls = [
      [-20, -20, 20, -20], [-20, -20, -20, 18], [20, -20, 20, 18],
      [-20, 18, -3.4, 18], [3.4, 18, 20, 18]
    ];
    this.wallSegs = [];
    for (const [x1, z1, x2, z2] of walls) {
      const L = Math.hypot(x2 - x1, z2 - z1) + T;
      const geo = new THREE.BoxGeometry(L, H, T);
      scaleBoxUV(geo, L, H, T);
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set((x1 + x2) / 2, H / 2, (z1 + z2) / 2);
      if (x1 === x2) m.rotation.y = Math.PI / 2;
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.28, T + 0.3), this.mats.darkStone);
      cap.position.copy(m.position); cap.position.y = H + 0.12; cap.rotation.y = m.rotation.y;
      cap.castShadow = true;
      this.scene.add(cap);
      this.wallSegs.push({ x1, z1, x2, z2 });
    }

    // Ivy: hanging strands of small leaves
    const count = this.low ? 900 : 2600;
    const ivy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.17, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), count);
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const greens = ['#3f6b35', '#2f5530', '#4f7a3a', '#5e7d4a', '#36602f'];
    let i = 0;
    while (i < count) {
      const seg = pick(this.wallSegs);
      const t = srand();
      const x = lerp(seg.x1, seg.x2, t), z = lerp(seg.z1, seg.z2, t);
      const alongZ = seg.x1 === seg.x2;
      const sides = seg.z1 === 18 && seg.z2 === 18 ? [-1, 1, 1] : [-1, 1];
      let side = pick(sides);
      // inside faces point to the garden centre
      if (!alongZ && seg.z1 === -20) side = 1;
      if (alongZ) side = seg.x1 < 0 ? 1 : -1;
      const len = sr(0.6, 3.8);
      const strand = Math.floor(sr(6, 22));
      for (let k = 0; k < strand && i < count; k++, i++) {
        const y = H - (k / strand) * len + sr(-0.1, 0.1);
        const off = T / 2 + 0.06;
        const jitter = sr(-0.35, 0.35);
        if (alongZ) d.position.set(x + side * off, y, z + jitter);
        else d.position.set(x + jitter, y, z + side * off);
        d.rotation.set(sr(0, 3), sr(0, 3), sr(0, 3));
        const s = sr(0.7, 1.25);
        d.scale.set(s, s, s * 0.45);
        d.updateMatrix();
        ivy.setMatrixAt(i, d.matrix);
        ivy.setColorAt(i, col.set(pick(greens)));
      }
    }
    this.scene.add(ivy);
  }

  _buildGate() {
    const g = new THREE.Group();
    g.position.set(0, 0, 18);
    this.scene.add(g);
    const wallTex = this.mats.wall;
    for (const sx of [-1, 1]) {
      const pGeo = new THREE.BoxGeometry(1.4, 5.8, 1.4);
      scaleBoxUV(pGeo, 1.4, 5.8, 1.4);
      const p = new THREE.Mesh(pGeo, wallTex);
      p.position.set(sx * 2.7, 2.9, 0);
      p.castShadow = true;
      g.add(p);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.35, 1.75), this.mats.darkStone);
      cap.position.set(sx * 2.7, 5.95, 0);
      g.add(cap);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), this.mats.darkStone);
      ball.position.set(sx * 2.7, 6.48, 0);
      g.add(ball);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.34, 10, 24, Math.PI), this.mats.stone);
    arch.position.set(0, 4.4, 0);
    arch.castShadow = true;
    g.add(arch);

    // climbing roses on the arch
    const roseMat = new THREE.MeshStandardMaterial({ color: '#c45c74', roughness: 0.6 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#3f6b35', roughness: 0.9, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const a = sr(0.05, Math.PI - 0.05);
      const r = 2.05 + sr(-0.25, 0.3);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(i % 3 ? 0.2 : 0.14, 0), i % 3 ? leafMat : roseMat);
      m.position.set(Math.cos(a) * r, 4.4 + Math.sin(a) * r, sr(-0.3, 0.45));
      g.add(m);
    }

    // doors
    const plank = new THREE.MeshStandardMaterial({ map: plankTex(), color: '#b08a66', roughness: 0.85 });
    this.doors = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 2.0, 0, 0);
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.35, 0.16), plank);
      door.position.set(-sx * 1.0, 2.18, 0);
      door.castShadow = true;
      pivot.add(door);
      for (const y of [1.0, 3.4]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.2), this.mats.iron);
        band.position.set(-sx * 1.0, y, 0);
        pivot.add(band);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 16), this.mats.iron);
      ring.position.set(-sx * 1.7, 2.0, 0.14);
      pivot.add(ring);
      g.add(pivot);
      this.doors.push({ pivot, sx });
    }
    // lock plate on the left door
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.07), this.mats.gold);
    lock.position.set(1.8, 2.15, 0.12);
    this.doors[0].pivot.add(lock);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.02), this.mats.iron);
    hole.position.set(1.8, 2.1, 0.165);
    this.doors[0].pivot.add(hole);

    // the key (hidden until the gate opens)
    const key = new THREE.Group();
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 20), this.mats.gold);
    bow.position.z = 0.78;
    bow.rotation.y = Math.PI / 2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), this.mats.gold);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.32;
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.06), this.mats.gold);
    tooth1.position.set(0, -0.07, 0.06);
    const tooth2 = tooth1.clone(); tooth2.position.z = 0.16;
    key.add(bow, shaft, tooth1, tooth2);
    const keyGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texRadial, color: '#ffe7a8', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    keyGlow.scale.set(1.4, 1.4, 1);
    keyGlow.position.z = 0.4;
    key.add(keyGlow);
    key.visible = false;
    this.scene.add(key);
    this.key = key;

    this.gateLight = new THREE.PointLight('#ffd9a0', 0, 22, 1.6);
    this.gateLight.position.set(0, 3, 13);
    this.scene.add(this.gateLight);

    // flowers along the outside of the wall (always in bloom — contrast with the grey garden inside)
    const n = this.low ? 90 : 220;
    const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.14, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    const colors = ['#d98a9a', '#f2e4c9', '#e2b43c', '#a28fc0', '#f5f0e6', '#c45c74'];
    for (let i = 0; i < n; i++) {
      let x = sr(-19, 19);
      if (Math.abs(x) < 3.6) x += x < 0 ? -3.6 : 3.6;
      d.position.set(x, sr(0.2, 0.55), sr(18.8, 20.6));
      d.scale.setScalar(sr(0.7, 1.3));
      d.updateMatrix();
      heads.setMatrixAt(i, d.matrix);
      heads.setColorAt(i, c.set(pick(colors)));
    }
    this.scene.add(heads);
    const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.8, 1), this.mats.leafOuter, 30);
    for (let i = 0; i < 30; i++) {
      let x = sr(-19, 19);
      if (Math.abs(x) < 4) x += x < 0 ? -4 : 4;
      d.position.set(x, 0.4, sr(19.2, 20.8));
      d.scale.set(sr(0.8, 1.4), sr(0.6, 1), sr(0.8, 1.2));
      d.updateMatrix();
      bushes.setMatrixAt(i, d.matrix);
    }
    bushes.castShadow = true;
    this.scene.add(bushes);
  }

  _buildManor() {
    const tex = brickTex();
    tex.repeat.set(1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: '#9d9484', roughness: 0.95 });
    const geo = new THREE.BoxGeometry(40, 15, 8);
    scaleBoxUV(geo, 40, 15, 8, 2.6);
    const house = new THREE.Mesh(geo, mat);
    house.position.set(0, 7.5, -30.5);
    house.receiveShadow = true;
    this.scene.add(house);
    const roofGeo = new THREE.CylinderGeometry(5.4, 5.4, 41, 3, 1);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#4b4f55', roughness: 0.8 }));
    roof.rotation.x = Math.PI;
    roof.position.set(0, 17.2, -30.5);
    roof.scale.set(1, 0.75, 1);
    this.scene.add(roof);
    for (const x of [-14, -2, 11]) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.5, 1.4), mat);
      ch.position.set(x, 19.5, -31);
      this.scene.add(ch);
    }
    const glass = new THREE.MeshStandardMaterial({ color: '#2a3238', roughness: 0.2, metalness: 0.4 });
    const frame = new THREE.MeshStandardMaterial({ color: '#d9d0bd', roughness: 0.8 });
    for (const y of [6, 10.5]) {
      for (let x = -16; x <= 16; x += 5.3) {
        const isColin = y === 10.5 && Math.abs(x - -5.9) < 1;
        const fx = isColin ? -6 : x;
        const f = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.8, 0.15), frame);
        f.position.set(fx, y, -26.48);
        this.scene.add(f);
        if (isColin) continue;
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), glass);
        w.position.set(fx, y, -26.39);
        this.scene.add(w);
      }
    }
    // Colin's window: warm light, curtains and Colin inside
    this.colinGlass = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffb860', emissiveIntensity: 0.55, transparent: true, opacity: 0.45, roughness: 0.2 });
    const cw = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), this.colinGlass);
    cw.position.set(-6, 10.5, -26.36);
    this.scene.add(cw);
    const room = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.5), new THREE.MeshBasicMaterial({ color: '#8a5a3c' }));
    room.position.set(-6, 10.5, -27.2);
    this.scene.add(room);
    for (const sx of [-1, 1]) {
      const cur = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 2.4), new THREE.MeshStandardMaterial({ color: '#b54d66', roughness: 0.9, side: THREE.DoubleSide }));
      cur.position.set(-6 + sx * 0.55, 10.5, -26.5);
      this.scene.add(cur);
    }
    this.colinLight = new THREE.PointLight('#ffc27a', 6, 9, 1.5);
    this.colinLight.position.set(-6, 10.5, -24.6);
    this.scene.add(this.colinLight);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texRadial, color: '#ffcf8a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(5, 5, 1);
    glow.position.set(-6, 10.5, -26.2);
    this.scene.add(glow);
    this.colinGlow = glow;
  }

  _makeTree({ x, z, h = 3.4, r = 0.32, blobs = 6, spread = 1.8, mat, bend = 0 }) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r, h, 8), this.mats.bark);
    trunk.position.y = h / 2;
    trunk.rotation.z = bend;
    trunk.castShadow = true;
    tree.add(trunk);
    const canopies = [];
    for (let i = 0; i < blobs; i++) {
      const size = sr(1.1, 1.8) * (spread / 1.8);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), mat);
      m.position.set(sr(-spread, spread) * 0.7, h + sr(-0.2, 1.6), sr(-spread, spread) * 0.7);
      m.castShadow = true;
      m.userData.base = m.position.clone();
      tree.add(m);
      canopies.push(m);
    }
    this.scene.add(tree);
    return { tree, canopies, trunk };
  }

  _buildTrees() {
    // trees outside the walls (always green)
    const outer = [];
    for (let i = 0; i < (this.low ? 26 : 50); i++) {
      let x, z;
      do { x = sr(-60, 60); z = sr(-60, 70); } while ((Math.abs(x) < 23 && z > -24 && z < 21) || (Math.abs(x) < 6 && z > 20));
      outer.push(this._makeTree({ x, z, h: sr(3, 5.5), r: sr(0.3, 0.5), blobs: 5, spread: sr(2, 3.2), mat: this.mats.leafOuter }));
    }
    // a few close to the gate for the landing view
    [[-9, 26], [10, 27], [-15, 23], [16, 22.5], [-6, 37], [8, 39]].forEach(([x, z]) => this._makeTree({ x, z, h: sr(4, 5.5), r: 0.45, blobs: 7, spread: 2.8, mat: this.mats.leafOuter }));

    // trees inside the garden (they grow leaves as the garden is restored)
    this.innerCanopies = [];
    [[-16, 13], [16, 13.5], [-16.5, -3], [16.5, -2], [-6, -17.5], [7, -17.5], [-15.6, -15]].forEach(([x, z]) => {
      const t = this._makeTree({ x, z, h: sr(3, 4), r: 0.35, blobs: 6, spread: 2, mat: this.mats.canopyInner });
      this.innerCanopies.push(...t.canopies);
    });
  }

  /* ---------- the eight map locations ---------- */
  _locGroup(name) {
    const g = new THREE.Group();
    g.position.copy(LOCATIONS[name].pos);
    this.scene.add(g);
    return g;
  }

  _buildGardenObjects() {
    this.locGroups = {};
    this.rings = {};
    const L = LOCATIONS;

    // Old Tree
    {
      const g = this._locGroup('oldTree');
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 4.4, 9), this.mats.bark);
      trunk.position.y = 2.2; trunk.rotation.z = 0.06; trunk.castShadow = true;
      g.add(trunk);
      const hollow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshBasicMaterial({ color: '#21170f' }));
      hollow.position.set(0.15, 1.5, 0.88); hollow.rotation.x = -0.1;
      g.add(hollow);
      for (const [rx, rz, len] of [[0.9, 0.2, 2.6], [-0.8, -0.4, 2.4], [0.3, 1.1, 2.2], [-0.2, -1.2, 2]]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, len, 6), this.mats.bark);
        b.position.set(Math.sin(rx) * len * 0.45, 4.1 + len * 0.3, Math.sin(rz) * len * 0.4);
        b.rotation.set(rz * 0.8, 0, -rx * 0.8);
        b.castShadow = true;
        g.add(b);
      }
      for (let i = 0; i < 9; i++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(sr(1.3, 2), 1), this.mats.canopyInner);
        m.position.set(sr(-2.4, 2.4), sr(5.6, 7.6), sr(-2.2, 2.2));
        m.userData.base = m.position.clone();
        m.castShadow = true;
        g.add(m);
        this.innerCanopies.push(m);
      }
      for (let i = 0; i < 5; i++) {
        const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 1.4, 5), this.mats.bark);
        const a = (i / 5) * Math.PI * 2;
        root.position.set(Math.cos(a) * 0.9, 0.18, Math.sin(a) * 0.9);
        root.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3);
        g.add(root);
      }
      this.locGroups.oldTree = g;
    }

    // Rose Garden
    {
      const g = this._locGroup('roseGarden');
      this.roseBushes = [];
      const spots = [[0, 0], [1.9, 0.6], [-1.8, 0.8], [1.2, -1.7], [-1.3, -1.6], [0.2, 2], [2.4, -0.9], [-2.5, -0.5]];
      for (const [x, z] of spots) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), this.mats.bushInner);
        b.position.set(x, 0.55, z);
        b.scale.set(1, sr(0.75, 1.05), 1);
        b.castShadow = true;
        g.add(b);
        this.roseBushes.push(b);
      }
      const n = this.low ? 70 : 140;
      this.roses = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 1), new THREE.MeshStandardMaterial({ roughness: 0.55 }), n);
      this.roseData = [];
      const c = new THREE.Color();
      const reds = ['#c45c74', '#b54d66', '#d98a9a', '#e8a6b4', '#a83a52', '#f2d4cf'];
      for (let i = 0; i < n; i++) {
        const [bx, bz] = pick(spots);
        const v = new THREE.Vector3(sr(-1, 1), sr(0.1, 1), sr(-1, 1)).normalize().multiplyScalar(0.78);
        this.roseData.push({ x: bx + v.x, y: 0.55 + v.y * 0.85, z: bz + v.z, start: i < n * 0.55 ? sr(1.1, 2.0) : sr(2.5, 4.8) });
        this.roses.setColorAt(i, c.set(pick(reds)));
      }
      g.add(this.roses);
      // a small iron arch
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 6, 24, Math.PI), this.mats.iron);
      arch.position.set(-2.2, 0, 2.6); arch.rotation.y = 0.8;
      g.add(arch);
      this.locGroups.roseGarden = g;
    }

    // Colin's window (group at the window)
    this.locGroups.colinsWindow = this._locGroup('colinsWindow');

    // Fountain + planting beds
    {
      const g = this._locGroup('fountain');
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.25, 0.75, 32), this.mats.stone);
      basin.position.y = 0.37; basin.castShadow = true; basin.receiveShadow = true;
      g.add(basin);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(2.98, 0.17, 8, 40), this.mats.stone);
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.76;
      g.add(rim);
      this.waterMat = new THREE.MeshStandardMaterial({ color: '#5d5a48', roughness: 0.2, metalness: 0.15, emissive: '#1d3a3a', emissiveIntensity: 0 });
      const water = new THREE.Mesh(new THREE.CircleGeometry(2.8, 40), this.waterMat);
      water.rotation.x = -Math.PI / 2; water.position.y = 0.66;
      g.add(water);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.8, 14), this.mats.stone);
      ped.position.y = 1.4; ped.castShadow = true;
      g.add(ped);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.5, 0.38, 20), this.mats.stone);
      bowl.position.y = 2.42; bowl.castShadow = true;
      g.add(bowl);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), this.mats.stone);
      fin.position.y = 2.85;
      g.add(fin);
      // water drops
      const N = this.low ? 90 : 220;
      const pos = new Float32Array(N * 3);
      this.drops = { N, pos, vel: new Float32Array(N * 3), age: new Float32Array(N) };
      for (let i = 0; i < N; i++) this.drops.age[i] = Math.random() * 1.6;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.dropPoints = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, map: this.texRadial, color: '#d8eef0', transparent: true, opacity: 0, depthWrite: false }));
      g.add(this.dropPoints);
      // planting beds (6 plots)
      this.plotPositions = [[-4.8, -1.4], [-4.8, 0.4], [-4.8, 2.2], [4.8, -1.4], [4.8, 0.4], [4.8, 2.2]].map(([x, z]) => V(x, 0, z));
      for (const p of this.plotPositions) {
        const soil = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), this.mats.soil);
        soil.rotation.x = -Math.PI / 2;
        soil.position.set(p.x, 0.04, p.z);
        g.add(soil);
      }
      this.locGroups.fountain = g;
    }

    // Hidden Bench
    {
      const g = this._locGroup('hiddenBench');
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.75), this.mats.wood);
      seat.position.set(0, 0.56, 0); seat.castShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.65, 0.09), this.mats.wood);
      back.position.set(0, 1.0, -0.34); back.castShadow = true;
      g.add(seat, back);
      for (const [x, z] of [[-1.1, 0.3], [1.1, 0.3], [-1.1, -0.3], [1.1, -0.3]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), this.mats.iron);
        leg.position.set(x, 0.27, z);
        g.add(leg);
      }
      g.rotation.y = 0.6;
      // watering can
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.38, 12), new THREE.MeshStandardMaterial({ color: '#6b7f45', metalness: 0.4, roughness: 0.5 }));
      can.position.set(1.6, 0.19, 0.6);
      g.add(can);
      this.locGroups.hiddenBench = g;
    }

    // Digital Portal
    {
      const g = this._locGroup('digitalPortal');
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 12, 48), this.mats.stone);
      ring.position.y = 3.0; ring.castShadow = true;
      g.add(ring);
      for (const sx of [-1, 1]) {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), this.mats.darkStone);
        base.position.set(sx * 1.6, 0.45, 0);
        g.add(base);
      }
      this.portalUniforms = { uTime: { value: 0 }, uPower: { value: 0.1 } };
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2.15, 48), new THREE.ShaderMaterial({
        uniforms: this.portalUniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTime; uniform float uPower; varying vec2 vUv;
          void main(){
            vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
            float sw = sin(a * 3.0 + r * 9.0 - uTime * 1.6) * 0.5 + 0.5;
            float px = step(0.5, fract((vUv.x + vUv.y * 0.3) * 18.0 + uTime * 0.2)) * 0.08;
            vec3 c1 = vec3(0.37, 0.56, 0.52); vec3 c2 = vec3(0.79, 0.65, 0.38); vec3 c3 = vec3(0.71, 0.47, 0.53);
            vec3 col = mix(c1, c2, sw); col = mix(col, c3, smoothstep(0.3, 1.0, r) * 0.5) + px;
            col = mix(vec3(0.42, 0.42, 0.4), col, uPower) + (1.0 - r) * 0.3 * uPower;
            float alpha = smoothstep(1.0, 0.86, r) * (0.35 + 0.55 * uPower);
            gl_FragColor = vec4(col, alpha);
          }`
      }));
      disc.position.y = 3.0;
      g.add(disc);
      const N = 70;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      this.portalParticles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: this.texRadial, color: '#e2c98b', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.portalParticles.userData.seeds = Array.from({ length: N }, () => [Math.random() * Math.PI * 2, sr(2.5, 3.2), Math.random()]);
      g.add(this.portalParticles);
      g.rotation.y = -0.5;
      this.locGroups.digitalPortal = g;
    }

    // Final Garden (pergola)
    {
      const g = this._locGroup('finalGarden');
      const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshStandardMaterial({ color: '#c9bfac', roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = 0.03; floor.receiveShadow = true;
      g.add(floor);
      for (const [x, z] of [[-1.9, -1], [1.9, -1], [-1.9, 1], [1.9, 1]]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.6, 0.24), this.mats.wood);
        post.position.set(x, 1.8, z); post.castShadow = true;
        g.add(post);
      }
      for (const z of [-1, 1]) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.12, 6, 24, Math.PI), this.mats.wood);
        arch.position.set(0, 3.6, z);
        g.add(arch);
      }
      for (let x = -1.6; x <= 1.6; x += 0.8) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.4), this.mats.wood);
        beam.position.set(x, 3.6 + Math.sqrt(Math.max(0, 1.9 * 1.9 - x * x)), 0);
        g.add(beam);
      }
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1, 10), this.mats.stone);
      dial.position.y = 0.5;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 20), this.mats.gold);
      top.position.y = 1.04;
      g.add(dial, top);
      const n = 60;
      this.pergolaRoses = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.15, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
      this.pergolaData = [];
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const z = pick([-1, 1]) + sr(-0.15, 0.15);
        const a = sr(0, Math.PI);
        this.pergolaData.push({ x: Math.cos(a) * 1.9, y: 3.6 + Math.sin(a) * 1.9, z });
        this.pergolaRoses.setColorAt(i, c.set(pick(['#c45c74', '#e8a6b4', '#f2e4c9', '#d98a9a', '#3f6b35', '#4f7a3a'])));
      }
      g.add(this.pergolaRoses);
      this.locGroups.finalGarden = g;
    }

    this.locGroups.gardenGate = this._locGroup('gardenGate');

    // markers (rings) + invisible hit boxes
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const HITS = {
      gardenGate: [[6, 6.6, 2.2], [0, 3.3, 1.6]], oldTree: [[5.5, 9, 5.5], [0, 4.5, 0]], roseGarden: [[6.5, 3, 6.5], [0, 1.5, 0]],
      colinsWindow: [[3.2, 3.6, 1.2], [0, 0, 0]], fountain: [[6.8, 3.2, 6.8], [0, 1.6, 0]], hiddenBench: [[4.2, 3, 3.2], [0, 1.5, 0]],
      digitalPortal: [[5.8, 6.6, 2.2], [0, 3.2, 0]], finalGarden: [[4.6, 4.6, 3.4], [0, 2.3, 0]]
    };
    for (const name of Object.keys(LOCATIONS)) {
      const [[w, h, d], [ox, oy, oz]] = HITS[name];
      const hit = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
      hit.position.copy(LOCATIONS[name].pos).add(V(ox, oy, oz));
      if (name === 'digitalPortal') hit.rotation.y = -0.5;
      hit.userData = { kind: 'location', id: name };
      this.scene.add(hit);
      this.hitTargets.push(hit);
      const r = LOCATIONS[name].ring;
      if (r) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.16, r, 56), new THREE.MeshBasicMaterial({ color: '#f0d58c', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(LOCATIONS[name].pos); ring.position.y = 0.07;
        const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 40), new THREE.MeshBasicMaterial({ map: this.texRadial, color: '#f0d58c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.copy(ring.position); glow.position.y = 0.06;
        this.scene.add(ring, glow);
        this.rings[name] = { ring, glow, bloom: null };
      }
    }
  }

  _buildFlora() {
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    // grass blades
    const gN = this.low ? 900 : 2600;
    const grassGeo = new THREE.ConeGeometry(0.05, 0.42, 3);
    grassGeo.translate(0, 0.21, 0);
    this.grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), gN);
    this.grassData = [];
    const greens = ['#6f9a45', '#5f8a3e', '#7fa452', '#4f7a3a', '#8aac5a'];
    for (let i = 0; i < gN; i++) {
      let x, z;
      do { x = sr(-19.2, 19.2); z = sr(-19.2, 17.2); } while (Math.hypot(x, z - 2) < 3.4);
      this.grassData.push({ x, z, r: sr(0, 3), s: sr(0.6, 1.3), d: sr(0, 0.7), tilt: sr(-0.25, 0.25) });
      this.grass.setColorAt(i, c.set(pick(greens)));
    }
    this.scene.add(this.grass);

    // flowers (heads + stems) — they bloom through stages 2 → 5
    const fN = this.low ? 220 : 560;
    const stemGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.46, 4);
    stemGeo.translate(0, 0.23, 0);
    this.stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: '#4f7a3a' }), fN);
    this.flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), fN);
    this.flowerData = [];
    const colors = ['#d98a9a', '#f2e4c9', '#e2b43c', '#a28fc0', '#f5f0e6', '#c45c74', '#e8a6b4', '#c99a2e'];
    for (let i = 0; i < fN; i++) {
      let x, z;
      if (srand() < 0.6) {
        // beds along the walls
        const side = Math.floor(srand() * 4);
        if (side === 0) { x = sr(-19, 19); z = sr(-19.2, -17.4); }
        else if (side === 1) { x = sr(-19.2, -17.6); z = sr(-19, 17); }
        else if (side === 2) { x = sr(17.6, 19.2); z = sr(-19, 17); }
        else { x = sr(-19, 19); z = sr(15.6, 17.2); if (Math.abs(x) < 3.2) x += x < 0 ? -3.2 : 3.2; }
      } else {
        do { x = sr(-18, 18); z = sr(-18, 16); } while (Math.hypot(x, z - 2) < 3.6 || Math.abs(x) < 0.8);
      }
      this.flowerData.push({ x, z, s: sr(0.7, 1.3), start: sr(1.0, 4.4), h: sr(0.75, 1.25) });
      this.flowers.setColorAt(i, c.set(pick(colors)));
    }
    this.scene.add(this.stems, this.flowers);
  }

  _buildLife() {
    // birds
    const bodyGeo = new THREE.ConeGeometry(0.12, 0.5, 6);
    bodyGeo.rotateX(Math.PI / 2);
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.15, 0, 0, 0.15, 0.55, 0, 0]), 3));
    wingGeo.computeVertexNormals();
    const birdMat = new THREE.MeshStandardMaterial({ color: '#4a3a2e', side: THREE.DoubleSide, roughness: 0.8 });
    this.birds = [];
    for (let i = 0; i < 16; i++) {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(bodyGeo, birdMat));
      const wl = new THREE.Mesh(wingGeo, birdMat); const wr = new THREE.Mesh(wingGeo, birdMat);
      wr.scale.x = -1;
      b.add(wl, wr);
      b.userData = { wl, wr, r: sr(6, 16), h: sr(7, 13), speed: sr(0.25, 0.5) * (srand() < 0.5 ? 1 : -1), phase: sr(0, Math.PI * 2), cx: sr(-6, 6), cz: sr(-8, 6) };
      b.visible = false;
      this.scene.add(b);
      this.birds.push(b);
    }

    // butterflies
    this.butterflies = [];
    const bfColors = ['#f2e4c9', '#e2c98b', '#e8a6b4', '#c9d4bb', '#f5f0e6', '#d9a3c9'];
    for (let i = 0; i < 7; i++) {
      const bf = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: bfColors[i % bfColors.length], side: THREE.DoubleSide, roughness: 0.7 });
      const wg = new THREE.CircleGeometry(0.16, 8);
      wg.translate(0.16, 0, 0);
      const l = new THREE.Mesh(wg, m), r = new THREE.Mesh(wg, m);
      r.scale.x = -1;
      l.rotation.x = r.rotation.x = -Math.PI / 2;
      const wl = new THREE.Group(); wl.add(l);
      const wr = new THREE.Group(); wr.add(r);
      bf.add(wl, wr);
      bf.userData = { wl, wr, phase: sr(0, 10), sp: sr(0.3, 0.6), ax: sr(3, 9), az: sr(2, 6), cx: sr(-10, 10), cz: sr(-12, 10) };
      this.scene.add(bf);
      this.butterflies.push(bf);
    }

    // falling leaves / petals
    const lN = this.low ? 30 : 80;
    this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), lN);
    this.leafData = [];
    const c = new THREE.Color();
    for (let i = 0; i < lN; i++) {
      this.leafData.push(this._newLeaf(true));
      this.leaves.setColorAt(i, c.set(pick(['#8aa65a', '#c2a058', '#a8873f', '#6b7f45', '#d98a9a'])));
    }
    this.scene.add(this.leaves);

    // mist
    this.mist = [];
    const mistTex = radialTex('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    for (let i = 0; i < (this.low ? 6 : 12); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: '#f3eedf', transparent: true, opacity: 0.18, depthWrite: false }));
      const inside = i % 3 !== 0;
      s.position.set(sr(-18, 18), sr(0.8, 2.4), inside ? sr(-18, 14) : sr(20, 32));
      s.scale.set(sr(12, 20), sr(4, 6), 1);
      s.userData = { base: s.position.x, sp: sr(0.1, 0.3), ph: sr(0, 6), op: sr(0.12, 0.24) };
      this.scene.add(s);
      this.mist.push(s);
    }

    // sun rays
    this.shafts = [];
    const sTex = shaftTex();
    const rays = [[-6, 24], [5, 22], [10, 26], [-9, 2], [6, -6], [0, 10]];
    for (const [x, z] of rays) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 22), new THREE.MeshBasicMaterial({ map: sTex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.position.set(x, 9, z);
      m.rotation.set(0, sr(-0.4, 0.4), 0.42);
      m.userData = { ph: sr(0, 6) };
      this.scene.add(m);
      this.shafts.push(m);
    }

    // robin (the bird who shows Mary the key)
    const robin = new THREE.Group();
    const brown = new THREE.MeshStandardMaterial({ color: '#7a5a40', roughness: 0.8 });
    const red = new THREE.MeshStandardMaterial({ color: '#d4643a', roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), brown);
    body.scale.set(1, 0.95, 1.2);
    const breast = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), red);
    breast.position.set(0, -0.01, 0.1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), brown);
    head.position.set(0, 0.15, 0.13);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), this.mats.iron);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.14, 0.25);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.2), brown);
    tail.position.set(0, 0.05, -0.22); tail.rotation.x = -0.4;
    robin.add(body, breast, head, beak, tail);
    robin.position.set(-9.6, 0.18, 7.6);
    robin.scale.setScalar(1.6);
    robin.userData = { home: V(-9.6, 0.18, 7.6), target: V(-9.6, 0.18, 7.6), hopT: 0, head };
    this.scene.add(robin);
    this.robin = robin;

    // digital garden objects (hidden until the portal is used)
    this.digital = new THREE.Group();
    this.digital.visible = false;
    const kinds = ['dots', 'heart', 'bell', 'mail', 'dots', 'heart'];
    const texCache = {};
    for (let i = 0; i < 22; i++) {
      const kind = kinds[i % kinds.length];
      texCache[kind] = texCache[kind] || iconTex(kind);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texCache[kind], transparent: true, opacity: 0.92, depthWrite: false, fog: false }));
      s.position.set(sr(-16, 16), sr(2, 8), sr(-16, 12));
      s.scale.setScalar(sr(1.1, 1.8));
      s.userData = { base: s.position.clone(), ph: sr(0, 6), sp: sr(0.4, 0.9) };
      this.digital.add(s);
    }
    const cardTex = iconTex('card');
    const phoneMat = new THREE.MeshStandardMaterial({ color: '#2a3332', roughness: 0.4, metalness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const ph = new THREE.Group();
      const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.08), phoneMat);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.5), new THREE.MeshBasicMaterial({ map: cardTex, color: i % 2 ? '#d7ece6' : '#f3efe6' }));
      scr.position.z = 0.045;
      ph.add(bodyM, scr);
      ph.position.set(sr(-14, 14), sr(2.5, 6), sr(-14, 10));
      ph.rotation.set(sr(-0.3, 0.3), sr(-1, 1), sr(-0.3, 0.3));
      ph.userData = { base: ph.position.clone(), ph: sr(0, 6), sp: sr(0.3, 0.6) };
      this.digital.add(ph);
    }
    const grid = new THREE.GridHelper(40, 40, '#7fb3a8', '#5f8f84');
    grid.material.transparent = true; grid.material.opacity = 0.22;
    grid.position.set(0, 0.08, -1);
    this.digital.add(grid);
    this.scene.add(this.digital);
  }

  _newLeaf(initial = false) {
    const landing = this.mode === 'landing';
    const x = landing ? sr(-14, 14) : sr(-19, 19);
    const z = landing ? sr(12, 25) : sr(-19, 17);
    return { x, z, y: initial ? sr(0, 10) : sr(8, 12), vy: sr(0.4, 0.9), sp: sr(0.5, 2), ph: sr(0, 6), rot: sr(0, 6) };
  }

  /* ---------- characters ---------- */
  _makeCharacter({ skin, hair, outfit, dress = false, cap = null, hairColorFront = null, scale = 1.55 }) {
    const g = new THREE.Group();
    const skinM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
    const hairM = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 });
    const outM = new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.85 });
    const legM = new THREE.MeshStandardMaterial({ color: '#3a3330', roughness: 0.9 });
    const legs = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.09, 0.6, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.6, 6), legM);
      leg.position.y = -0.3;
      pivot.add(leg);
      g.add(pivot);
      legs.push(pivot);
    }
    const body = dress
      ? new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 12), outM)
      : new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.28, 0.65, 10), outM);
    body.position.y = dress ? 0.86 : 0.92;
    body.castShadow = true;
    g.add(body);
    const arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * (dress ? 0.2 : 0.29), 1.2, 0);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.5, 6), outM);
      arm.position.y = -0.25;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skinM);
      hand.position.y = -0.52;
      pivot.add(arm, hand);
      pivot.rotation.z = sx * 0.12;
      g.add(pivot);
      arms.push(pivot);
    }
    const headG = new THREE.Group();
    headG.position.y = 1.47;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), skinM);
    head.castShadow = true;
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), hairM);
    hairBack.position.set(0, 0.05, -0.04);
    hairBack.scale.set(1, 0.95, 0.95);
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshStandardMaterial({ color: hairColorFront || hair, roughness: 0.9 }));
    fringe.position.set(0, 0.06, 0.06);
    const eyeM = new THREE.MeshBasicMaterial({ color: '#221c18' });
    const eyes = [-1, 1].map(sx => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), eyeM); e.position.set(sx * 0.08, 0.02, 0.21); return e; });
    headG.add(hairBack, head, fringe, ...eyes);
    if (cap) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.3), new THREE.MeshStandardMaterial({ color: cap, roughness: 0.9 }));
      c.position.y = 0.06;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12, 1, false, -Math.PI / 2, Math.PI), c.material);
      brim.position.set(0, 0.07, 0.2);
      headG.add(c, brim);
    }
    g.add(headG);
    g.scale.setScalar(scale);
    g.userData = { headG, arms, legs, body, mood: 'idle', moodT: 0, baseY: 0, walk: null };
    this.scene.add(g);
    return g;
  }

  _buildCharacters() {
    const mary = this._makeCharacter({ skin: '#f2d4bf', hair: '#3a2a21', outfit: '#2f3b55', dress: true });
    mary.position.set(-14.2, 0, 8.8);
    mary.userData.walk = { a: V(-14.6, 0, 8.4), b: V(-13.4, 0, 10.8), t: 0 };
    this.characters.mary = mary;

    const dickon = this._makeCharacter({ skin: '#e3b591', hair: '#a2532c', outfit: '#6b5a3a', cap: '#5d6b3a' });
    dickon.position.set(-11.4, 0, -8.6);
    dickon.rotation.y = 0.9;
    this.characters.dickon = dickon;
    // Dickon's animal friends: a crow on his shoulder and a little fox
    const crow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: '#1e1e22' }));
    crow.position.set(0.3, 1.32, 0); crow.scale.set(1, 1, 1.5);
    dickon.add(crow);
    const fox = new THREE.Group();
    const foxM = new THREE.MeshStandardMaterial({ color: '#c46a2f', roughness: 0.8 });
    const fb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), foxM); fb.scale.set(0.8, 0.7, 1.3); fb.position.y = 0.3;
    const fh = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), foxM); fh.rotation.x = Math.PI / 2; fh.position.set(0, 0.42, 0.42);
    const ft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), foxM); ft.rotation.x = -Math.PI / 2.6; ft.position.set(0, 0.35, -0.48);
    fox.add(fb, fh, ft);
    fox.position.set(-10.2, 0, -8.3);
    fox.rotation.y = -0.6;
    this.scene.add(fox);
    this.fox = fox;

    // Colin in his window (upper body)
    const colinWin = new THREE.Group();
    const cSkin = new THREE.MeshStandardMaterial({ color: '#f4ddcd' });
    const cHair = new THREE.MeshStandardMaterial({ color: '#1f1a1a' });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.7, 10), new THREE.MeshStandardMaterial({ color: '#c7d0d9' }));
    torso.position.y = -0.4;
    const chead = new THREE.Group();
    chead.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), cSkin));
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), cHair); ch.position.set(0, 0.06, -0.05);
    chead.add(ch);
    chead.position.y = 0.12;
    colinWin.add(torso, chead);
    colinWin.position.set(-6, 10.0, -26.75);
    colinWin.userData = { head: chead, mood: 'sad' };
    this.scene.add(colinWin);
    this.characters.colinWindow = colinWin;

    // Colin in the garden (wheelchair → standing)
    const colin = this._makeCharacter({ skin: '#f4ddcd', hair: '#1f1a1a', outfit: '#c7d0d9' });
    colin.visible = false;
    this.characters.colin = colin;
    const chair = new THREE.Group();
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 6, 20), this.mats.iron);
      wheel.rotation.y = Math.PI / 2; wheel.position.set(sx * 0.5, 0.45, 0);
      chair.add(wheel);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), this.mats.wood);
    seat.position.y = 0.62;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.08), this.mats.wood);
    back.position.set(0, 1.0, -0.33);
    chair.add(seat, back);
    chair.visible = false;
    this.scene.add(chair);
    this.chair = chair;
  }

  /* ---------- collectibles ---------- */
  _buildCollectibles() {
    const spots = {
      feather: V(-17.4, 0.35, 14.2), rose: V(17, 0.4, 10.5), page1: V(3.6, 0.35, 15.4),
      page2: V(-17.2, 0.35, -16.6), page3: V(17.2, 0.35, -16.8)
    };
    const sparkTex = radialTex('rgba(255,250,220,1)', 'rgba(255,230,160,0)');
    const pTex = pageTex();
    for (const [id, pos] of Object.entries(spots)) {
      const g = new THREE.Group();
      g.position.copy(pos);
      let mesh;
      if (id === 'feather') {
        mesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#a0522d' }));
        mesh.scale.set(1, 1, 0.3); mesh.rotation.z = 1.2;
      } else if (id === 'rose') {
        mesh = new THREE.Group();
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), new THREE.MeshStandardMaterial({ color: '#4f7a3a' }));
        const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshStandardMaterial({ color: '#b02b45', roughness: 0.5 }));
        hd.position.y = 0.28;
        mesh.add(st, hd);
      } else {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.6), new THREE.MeshStandardMaterial({ map: pTex, side: THREE.DoubleSide, roughness: 0.9 }));
        mesh.rotation.set(-1.0, 0.4, 0.2);
      }
      const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      spark.scale.set(1.2, 1.2, 1);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.userData = { kind: 'collectible', id };
      g.add(mesh, spark, hit);
      g.userData = { spark, ph: srand() * 6, mesh };
      this.scene.add(g);
      this.hitTargets.push(hit);
      this.collectibles[id] = { group: g, hit, found: false };
    }
  }

  setCollected(ids = []) {
    for (const [id, c] of Object.entries(this.collectibles)) {
      c.found = ids.includes(id);
      c.group.visible = !c.found;
    }
  }

  _collectAnim(id) {
    const c = this.collectibles[id];
    if (!c || c.found) return;
    c.found = true;
    const g = c.group;
    tween(g.position, { y: g.position.y + 2 }, { duration: 1.1, ease: 'power2.out' });
    tween(g.scale, { x: 0.01, y: 0.01, z: 0.01 }, { duration: 1.1, ease: 'power2.inOut' }).then(() => { g.visible = false; });
    this._burst(g.position.clone(), ['#fff2c4', '#e2c98b', '#f2e4c9'], 30);
  }

  /* ---------- stage (garden restoration) ---------- */
  _applyStage(sv, force = false) {
    if (!force && Math.abs(sv - this._appliedStage) < 0.0005) return;
    this._appliedStage = sv;
    const final = this.finalBoost;
    const d = new THREE.Object3D();

    // ground colour: dry → green
    const g = smooth(sv / 2);
    this.innerGroundMat.color.set('#6e6450').lerp(new THREE.Color('#5c8a3c'), g);

    // grass
    this.grassData.forEach((p, i) => {
      const grow = 0.18 + 0.82 * smooth((sv - p.d) / 0.9);
      d.position.set(p.x, 0, p.z);
      d.rotation.set(p.tilt, p.r, 0);
      d.scale.set(p.s, p.s * grow, p.s);
      d.updateMatrix();
      this.grass.setMatrixAt(i, d.matrix);
    });
    this.grass.instanceMatrix.needsUpdate = true;
    this.grass.material.color.set('#8c8064').lerp(new THREE.Color('#ffffff'), g);

    // flowers
    this.flowerData.forEach((p, i) => {
      const s = Math.max(smooth((sv - p.start) / 0.7), final);
      const hh = 0.46 * p.h * Math.max(s, 0.001);
      d.position.set(p.x, 0, p.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, Math.max(s, 0.001) * p.h, 1);
      d.updateMatrix();
      this.stems.setMatrixAt(i, d.matrix);
      d.position.set(p.x, hh + 0.02, p.z);
      d.scale.setScalar(Math.max(s * p.s, 0.001));
      d.updateMatrix();
      this.flowers.setMatrixAt(i, d.matrix);
    });
    this.stems.instanceMatrix.needsUpdate = true;
    this.flowers.instanceMatrix.needsUpdate = true;

    // roses
    this.roseData.forEach((p, i) => {
      const s = Math.max(smooth((sv - p.start) / 0.6), final);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(Math.max(s, 0.001));
      d.updateMatrix();
      this.roses.setMatrixAt(i, d.matrix);
    });
    this.roses.instanceMatrix.needsUpdate = true;

    // tree canopies and bushes
    const leaf = smooth((sv - 2) / 1.1);
    this.mats.canopyInner.color.set('#6f6655').lerp(new THREE.Color('#4c7a3a'), leaf);
    for (const m of this.innerCanopies) m.scale.setScalar(0.42 + 0.58 * leaf);
    this.mats.bushInner.color.set('#5e5a48').lerp(new THREE.Color('#3f6b35'), smooth((sv - 1) / 1.2));

    // fountain water
    const water = Math.max(smooth((sv - 4) / 1), final);
    this.waterMat.color.set('#5d5a48').lerp(new THREE.Color('#7fb3b3'), water);
    this.waterMat.emissiveIntensity = water * 0.25;
    this.fountainOn = water;

    // pergola roses (final garden)
    const pg = Math.max(final, smooth((sv - 4.6) / 0.4) * 0.6);
    this.pergolaData.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z);
      d.scale.setScalar(Math.max(pg, 0.001));
      d.updateMatrix();
      this.pergolaRoses.setMatrixAt(i, d.matrix);
    });
    this.pergolaRoses.instanceMatrix.needsUpdate = true;
  }

  /** Animate the garden to restoration stage n (0–5). */
  setGardenStage(n, animate = true) {
    const target = Math.max(0, Math.min(5, n));
    if (!animate) { this.stageValue = target; this._applyStage(target, true); this._refreshPalette(); return Promise.resolve(); }
    const obj = this;
    return tween(obj, { stageValue: target }, { duration: 3.2, ease: 'power1.inOut', onUpdate: () => this._refreshPalette() });
  }

  /* ---------- palette & mode ---------- */
  _paletteFor() {
    if (this.mode === 'landing') return PALETTES.landing;
    if (this.mode === 'digital') return PALETTES.digital;
    if (this.mode === 'final') return PALETTES.final;
    const t = smooth(this.stageValue / 5);
    const a = PALETTES.gloom, b = PALETTES.bloom;
    const out = {};
    for (const k of Object.keys(a)) {
      if (typeof a[k] === 'number') out[k] = lerp(a[k], b[k], t);
      else out[k] = '#' + new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t).getHexString();
    }
    return out;
  }

  _refreshPalette() { this.paletteTarget = this._paletteFor(); }

  _setPaletteInstant(mode) {
    this.mode = mode;
    const p = this._paletteFor();
    for (const k of ['top', 'bottom', 'fog', 'sun', 'sky', 'ground']) this.palette[k].set(p[k]);
    for (const k of ['sunI', 'hemiI', 'near', 'far']) this.palette[k] = p[k];
    this.paletteTarget = p;
    this._pushPalette();
  }

  _pushPalette() {
    const p = this.palette;
    this.skyUniforms.top.value.copy(p.top);
    this.skyUniforms.bottom.value.copy(p.bottom);
    this.scene.fog.color.copy(p.fog);
    const aspect = window.innerWidth / window.innerHeight;
    const fogScale = aspect < 1.3 ? 1 + (1.3 - aspect) * 1.4 : 1;
    this.scene.fog.near = p.near * fogScale;
    this.scene.fog.far = p.far * fogScale;
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunI;
    this.hemi.color.copy(p.sky);
    this.hemi.groundColor.copy(p.ground);
    this.hemi.intensity = p.hemiI;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'final') {
      this.stageValue = 5;
      tween(this, { finalBoost: 1 }, { duration: 2.5, onUpdate: () => this._applyStage(this.stageValue, true) });
      this._placeFinalCharacters();
    }
    this.digital.visible = mode === 'digital';
    this._refreshPalette();
    for (const c of Object.values(this.collectibles)) c.group.visible = !c.found && (mode === 'hub' || mode === 'final');
  }

  _placeFinalCharacters() {
    const { mary, dickon, colin } = this.characters;
    mary.userData.walk = null;
    mary.position.set(-2.2, 0, 6.4); mary.rotation.y = 0.3;
    dickon.position.set(2.2, 0, 6.4); dickon.rotation.y = -0.3;
    colin.visible = true; colin.position.set(0, 0, 6.9); colin.rotation.y = 0;
    this.chair.visible = false;
    this.fox.position.set(3.4, 0, 7.4);
    this.characters.colinWindow.visible = false;
    for (const c of ['mary', 'dickon', 'colin']) this.setMood(c, 'happy', 999);
  }

  /** Called when a mission is completed (updates the 3D characters). */
  setStoryProgress(completed = []) {
    const cw = this.characters.colinWindow;
    if (completed.includes('m3')) cw.userData.mood = 'happy';
    if (completed.includes('m4') && this.mode !== 'final') {
      // Colin is now in the garden, in his wheelchair next to Dickon
      const colin = this.characters.colin;
      colin.visible = true;
      colin.position.set(-10.2, 0.25, -6.9);
      colin.rotation.y = 2.4;
      colin.userData.sitting = true;
      this.chair.visible = true;
      this.chair.position.set(-10.2, 0, -6.9);
      this.chair.rotation.y = 2.4;
      cw.visible = false;
    }
  }

  setMood(name, mood, seconds = 4) {
    const c = this.characters[name];
    if (!c) return;
    if (name === 'colin' && !c.visible) {
      this.characters.colinWindow.userData.mood = mood;
      return;
    }
    c.userData.mood = mood;
    c.userData.moodT = seconds;
  }

  /* ---------- camera ---------- */
  landingView() { return { pos: V(0, 2.5, 33.5), look: V(0, 3.5, 18) }; }

  overviewView() {
    const aspect = window.innerWidth / window.innerHeight;
    const portrait = aspect < 0.9;
    const look = portrait ? V(0, 0, -1.5) : V(0, 0, -3);
    const base = portrait ? V(0, 30, 22) : V(0, 25, 34);
    const k = aspect < 1.3 ? 1 + (1.3 - aspect) * (portrait ? 1.25 : 0.95) : 1;
    return { pos: look.clone().add(base.clone().sub(look).multiplyScalar(k)), look };
  }

  focusView(name) {
    const L = LOCATIONS[name];
    const aspect = window.innerWidth / window.innerHeight;
    const k = aspect < 1.1 ? 1 + (1.1 - aspect) * 0.8 : 1;
    // on wide screens, shift the view so the object sits above the story panel
    const look = L.look.clone();
    const pos = look.clone().add(L.cam.clone().sub(L.look).multiplyScalar(k));
    look.y -= 0.9;
    pos.y += 0.4;
    return { pos, look };
  }

  _applyCameraView(v) {
    this.camBase.copy(v.pos);
    this.lookBase.copy(v.look);
  }

  cameraTo(view, duration = 1.8) {
    this._atOverview = false;
    return Promise.all([
      tween(this.camBase, { x: view.pos.x, y: view.pos.y, z: view.pos.z }, { duration, ease: 'power2.inOut' }),
      tween(this.lookBase, { x: view.look.x, y: view.look.y, z: view.look.z }, { duration, ease: 'power2.inOut' })
    ]);
  }

  async toOverview(duration = 1.8) {
    await this.cameraTo(this.overviewView(), duration);
    this._atOverview = true;
  }

  focus(name, duration = 1.6) { return this.cameraTo(this.focusView(name), duration); }

  approachGate() { return this.cameraTo({ pos: V(0, 2.5, 25.5), look: V(0, 2.7, 18) }, 2.2); }

  digitalView() { return this.cameraTo({ pos: V(0, 7.5, 15), look: V(0, 4, -4) }, 1.2); }

  /* ---------- gate cinematic ---------- */
  async openGate({ onThrough } = {}) {
    const key = this.key;
    // 1) camera closer
    await this.cameraTo({ pos: V(0, 2.4, 22.8), look: V(-0.2, 2.2, 18) }, 1.4);
    // 2) the key appears
    key.visible = true;
    key.position.set(-0.2, 2.0, 21.2);
    key.rotation.set(0, 0, 0);
    key.scale.setScalar(0.01);
    await Promise.all([
      tween(key.scale, { x: 1.4, y: 1.4, z: 1.4 }, { duration: 0.8, ease: 'back.out' }),
      tween(key.rotation, { y: Math.PI * 2 }, { duration: 1.1, ease: 'power2.out' })
    ]);
    key.rotation.y = 0;
    // 3) into the lock
    await tween(key.position, { x: -0.2, y: 2.1, z: 18.28 }, { duration: 0.9, ease: 'power2.inOut' });
    this.emit('sound', 'keyTurn');
    await tween(key.rotation, { z: Math.PI / 2 }, { duration: 0.55, ease: 'power2.inOut' });
    // 4) the doors open
    this.emit('sound', 'gate');
    const [left, right] = this.doors;
    tween(key.scale, { x: 0.01, y: 0.01, z: 0.01 }, { duration: 0.6 }).then(() => { key.visible = false; });
    await Promise.all([
      tween(left.pivot.rotation, { y: 1.85 }, { duration: 2.2, ease: 'power2.inOut' }),
      tween(right.pivot.rotation, { y: -1.85 }, { duration: 2.2, ease: 'power2.inOut', delay: 0.1 }),
      tween(this.gateLight, { intensity: 40 }, { duration: 2.0 })
    ]);
    // 5) through the gate into the garden
    onThrough?.();
    this.emit('sound', 'whoosh');
    await this.cameraTo({ pos: V(0, 3.0, 12), look: V(0, 2.2, 0) }, 2.0);
    this._setPaletteBlend('hub');
    tween(this.gateLight, { intensity: 0 }, { duration: 2 });
    await this.toOverview(2.4);
  }

  _setPaletteBlend(mode) {
    this.mode = mode;
    this._refreshPalette();
  }

  setGateOpen(open = true) {
    const [left, right] = this.doors;
    left.pivot.rotation.y = open ? 1.85 : 0;
    right.pivot.rotation.y = open ? -1.85 : 0;
    this.key.visible = false;
  }

  /* ---------- map locations ---------- */
  setLocationStates(states) {
    this.locStates = { ...states };
    const colors = { locked: '#7d7f76', available: '#f0d58c', completed: '#a9cf88', info: '#e9dcc3' };
    for (const [name, st] of Object.entries(states)) {
      const r = this.rings[name];
      if (r) {
        r.ring.material.color.set(colors[st] || colors.info);
        r.ring.material.opacity = st === 'locked' ? 0.25 : st === 'info' ? 0.3 : 0.6;
        r.glow.material.color.set(colors[st] || colors.info);
        if (st === 'completed' && !r.bloom) r.bloom = this._bloomRing(name);
      }
    }
    this.portalUniforms.uPower.value = states.digitalPortal === 'locked' ? 0.12 : 1;
    this.portalParticles.visible = states.digitalPortal !== 'locked';
  }

  _bloomRing(name) {
    const L = LOCATIONS[name];
    const n = 14;
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      d.position.set(L.pos.x + Math.cos(a) * (L.ring + 0.35), 0.25, L.pos.z + Math.sin(a) * (L.ring + 0.35));
      d.scale.setScalar(sr(0.8, 1.3));
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, c.set(pick(['#e8a6b4', '#f2e4c9', '#e2b43c', '#a28fc0', '#c45c74'])));
    }
    mesh.scale.setScalar(1);
    this.scene.add(mesh);
    return mesh;
  }

  /** Screen position of a location's pin (for the HTML map pins). */
  project(name) {
    const L = LOCATIONS[name];
    const v = L.pos.clone();
    v.y += L.pinY;
    return this._toScreen(v);
  }

  _toScreen(v) {
    const p = v.clone().project(this.camera);
    const w = window.innerWidth, h = window.innerHeight;
    return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, visible: p.z < 1 && p.x > -1.1 && p.x < 1.1 && p.y > -1.1 && p.y < 1.1 };
  }

  screenOf(name) { return this._toScreen(LOCATIONS[name].pos.clone().add(V(0, 1.5, 0))); }

  setHover(name) { this.hover = name; }

  /* ---------- effects ---------- */
  _burst(pos, colors = ['#e8a6b4', '#f2e4c9', '#e2c98b', '#a9cf88'], n = 60) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = [];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y; arr[i * 3 + 2] = pos.z;
      vel.push(V(sr(-2.5, 2.5), sr(2, 5.5), sr(-2.5, 2.5)));
      c.set(pick(colors));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.28, map: this.texRadial, vertexColors: true, transparent: true, depthWrite: false }));
    this.scene.add(pts);
    const light = new THREE.PointLight('#ffe7a8', 30, 12, 1.5);
    light.position.copy(pos).add(V(0, 1.5, 0));
    this.scene.add(light);
    this.bursts.push({ pts, vel, age: 0, light });
  }

  /** A successful (empathic) choice: flowers open and light grows at the location. */
  celebrate(name) {
    const L = LOCATIONS[name];
    if (!L) return;
    const p = L.pos.clone();
    if (name === 'colinsWindow') p.z += 1.2;
    p.y += name === 'colinsWindow' ? 0 : 1.2;
    this._burst(p);
  }

  /* ---------- planting ---------- */
  addPlant(index, type, animate = true) {
    const p = this.plotPositions[index];
    if (!p) return;
    const g = new THREE.Group();
    const base = LOCATIONS.fountain.pos;
    g.position.set(base.x + p.x, 0, base.z + p.z);
    const green = new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.9, flatShading: true });
    if (type === 'rose') {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), green); b.position.y = 0.4; g.add(b);
      const rm = new THREE.MeshStandardMaterial({ color: '#b54d66', roughness: 0.5 });
      for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), rm); const v = V(sr(-1, 1), sr(0.2, 1), sr(-1, 1)).normalize().multiplyScalar(0.47); r.position.set(v.x, 0.4 + v.y, v.z); g.add(r); }
    } else if (type === 'sunflower') {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), green); st.position.y = 0.8; g.add(st);
      const pet = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 14), new THREE.MeshStandardMaterial({ color: '#e2b43c' }));
      pet.rotation.x = Math.PI / 2 - 0.3; pet.position.set(0, 1.65, 0.05); g.add(pet);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 14), new THREE.MeshStandardMaterial({ color: '#6b4423' }));
      disc.rotation.copy(pet.rotation); disc.position.set(0, 1.66, 0.09); g.add(disc);
    } else if (type === 'lavender') {
      const pm = new THREE.MeshStandardMaterial({ color: '#8e78ab', roughness: 0.8 });
      for (let i = 0; i < 9; i++) {
        const a = sr(0, 6.28), r = sr(0, 0.3);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.8, 4), green);
        st.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r); st.rotation.set(sr(-0.2, 0.2), 0, sr(-0.2, 0.2)); g.add(st);
        const top = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.25, 3, 6), pm);
        top.position.set(st.position.x, 0.9, st.position.z); g.add(top);
      }
    } else if (type === 'fern') {
      for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 4), green);
        const a = (i / 7) * Math.PI * 2;
        f.position.set(Math.cos(a) * 0.25, 0.45, Math.sin(a) * 0.25);
        f.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        f.scale.set(1, 1, 0.3);
        g.add(f);
      }
    } else {
      const im = new THREE.MeshStandardMaterial({ color: '#3f6b35', flatShading: true });
      for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), im); l.position.set(sr(-0.5, 0.5), sr(0.08, 0.4), sr(-0.5, 0.5)); g.add(l); }
    }
    this.scene.add(g);
    this.plants.push(g);
    if (animate) {
      g.scale.setScalar(0.01);
      tween(g.scale, { x: 1, y: 1, z: 1 }, { duration: 1.6, ease: 'back.out' });
      this._burst(g.position.clone().add(V(0, 0.6, 0)), ['#a9cf88', '#f2e4c9', '#e2c98b'], 24);
    }
  }

  /* ---------- Find the Key mini-game ---------- */
  startFindKey(onMessage) {
    return new Promise(resolve => {
      const base = LOCATIONS.oldTree.pos;
      const group = new THREE.Group();
      this.scene.add(group);
      const spots = [
        { id: 'pot', pos: V(-2.6, 0, 2.6), msg: 'Just an old flowerpot with dry soil.', make: () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.55, 12), new THREE.MeshStandardMaterial({ color: '#b5653a' })); m.position.y = 0.28; return m; } },
        { id: 'stone', pos: V(2.4, 0, -1.8), msg: 'Nothing under this stone — only a beetle.', make: () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), this.mats.darkStone); m.scale.set(1.2, 0.6, 1); m.position.y = 0.2; return m; } },
        { id: 'leaves', pos: V(-1.6, 0, -2.4), msg: 'Only dry leaves here…', make: () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: '#a8873f', flatShading: true })); m.scale.set(1.3, 0.4, 1.1); m.position.y = 0.12; return m; } },
        { id: 'hollow', pos: V(0.15, 1.5, 0.95), msg: 'An empty hollow in the tree. The robin chirps nearby…', make: () => new THREE.Group() },
        { id: 'soil', pos: V(1.3, 0, 2.0), key: true, msg: '', make: () => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), this.mats.soil); m.rotation.x = -Math.PI / 2; m.position.y = 0.05; return m; } }
      ];
      const hits = [];
      const ringMat = new THREE.MeshBasicMaterial({ color: '#f0d58c', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      for (const s of spots) {
        const g = new THREE.Group();
        g.position.copy(base).add(s.pos);
        g.add(s.make());
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 32), ringMat.clone());
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = s.id === 'hollow' ? -1.45 : 0.06;
        if (s.id === 'hollow') { ring.rotation.x = 0; ring.position.set(0, 0, 0.05); }
        g.add(ring);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        hit.position.y = s.id === 'hollow' ? 0 : 0.4;
        hit.userData = { kind: 'keyspot', id: s.id };
        g.add(hit);
        g.userData = { ring, spot: s };
        group.add(g);
        hits.push(hit);
      }
      let wrong = 0;
      const robin = this.robin;
      this.keyHunt = {
        hits,
        group,
        click: async id => {
          const g = group.children.find(c => c.userData.spot.id === id);
          if (!g || g.userData.done) return;
          const s = g.userData.spot;
          if (!s.key) {
            g.userData.done = true;
            g.userData.ring.visible = false;
            tween(g.rotation, { z: 0.15 }, { duration: 0.12 }).then(() => tween(g.rotation, { z: -0.15 }, { duration: 0.12 })).then(() => tween(g.rotation, { z: 0 }, { duration: 0.12 }));
            wrong++;
            onMessage?.(s.msg + (wrong >= 2 ? ' Look — the robin is scratching at the soil!' : ''));
            if (wrong >= 2) robin.userData.target = base.clone().add(V(1.2, 0.18, 2.4));
            return;
          }
          // found the key!
          this.keyHunt.done = true;
          this._burst(g.position.clone().add(V(0, 0.3, 0)), ['#7a5a40', '#a8873f', '#e2c98b'], 30);
          const key = this.key;
          key.visible = true;
          key.scale.setScalar(1.6);
          key.rotation.set(0, 0, 0);
          key.position.copy(g.position).add(V(0, 0.1, 0));
          await tween(key.position, { y: g.position.y + 1.6 }, { duration: 1.2, ease: 'power2.out' });
          await tween(key.rotation, { y: Math.PI * 2 }, { duration: 1.2 });
          await new Promise(r => setTimeout(r, motion.reduced ? 100 : 500));
          key.visible = false;
          this.scene.remove(group);
          this.keyHunt = null;
          robin.userData.target = robin.userData.home.clone();
          resolve();
        }
      };
      robin.userData.target = base.clone().add(V(-0.5, 0.18, 3.2));
    });
  }

  /* ---------- digital mode ---------- */
  enterDigital() {
    this.setMode('digital');
    return this.digitalView();
  }

  exitDigital() {
    this.setMode('hub');
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  /* ---------- pointer (hover & click) ---------- */
  _bindPointer() {
    const el = this.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    let downAt = null;
    const pickHit = e => {
      const r = el.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this.mouse, this.camera);
      let targets = [];
      if (this.keyHunt) targets = this.keyHunt.hits;
      else if (this.interactive) targets = this.hitTargets.filter(h => h.userData.kind === 'location' || (h.userData.kind === 'collectible' && !this.collectibles[h.userData.id].found && this.collectibles[h.userData.id].group.visible));
      const hit = this.raycaster.intersectObjects(targets, false)[0];
      return hit ? hit.object.userData : null;
    };
    el.addEventListener('pointermove', e => {
      if (this.paused) return;
      const h = pickHit(e);
      el.style.cursor = h ? 'pointer' : '';
      const key = h ? h.kind + ':' + h.id : null;
      if (key !== this._hoverKey) {
        this._hoverKey = key;
        if (this.keyHunt) {
          for (const g of this.keyHunt.group.children) g.userData.ring.material.opacity = h && g.userData.spot.id === h.id ? 1 : 0.6;
        }
        this.emit('hover', h, { x: e.clientX, y: e.clientY });
      } else if (h) {
        this.emit('hovermove', h, { x: e.clientX, y: e.clientY });
      }
    });
    el.addEventListener('pointerleave', () => { this._hoverKey = null; this.emit('hover', null); });
    el.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', e => {
      if (!downAt || this.paused) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 8) return;
      const h = pickHit(e);
      if (!h) return;
      if (h.kind === 'keyspot') { this.keyHunt?.click(h.id); return; }
      if (h.kind === 'collectible') { this._collectAnim(h.id); this.emit('collect', h.id); return; }
      this.emit('select', h.id);
    });
  }

  /* ---------- animation loop ---------- */
  _loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      if (this.paused) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.time += dt;
      this._update(dt, this.time);
      this.renderer.render(this.scene, this.camera);
      this.emit('frame');
    };
    tick();
  }

  _update(dt, t) {
    const reduced = motion.reduced;
    // palette blending
    if (this.paletteTarget) {
      const k = 1 - Math.exp(-dt * 1.6);
      const p = this.palette, tg = this.paletteTarget;
      for (const key of ['top', 'bottom', 'fog', 'sun', 'sky', 'ground']) p[key].lerp(new THREE.Color(tg[key]), k);
      for (const key of ['sunI', 'hemiI', 'near', 'far']) p[key] = lerp(p[key], tg[key], k);
      this._pushPalette();
    }
    this._applyStage(this.stageValue);

    // camera with a gentle drift
    const drift = reduced ? 0 : 1;
    const cam = this.camera;
    cam.position.set(
      this.camBase.x + Math.sin(t * 0.21) * 0.25 * drift,
      this.camBase.y + Math.sin(t * 0.33) * 0.12 * drift,
      this.camBase.z + Math.cos(t * 0.17) * 0.2 * drift
    );
    cam.lookAt(this.lookBase);

    // hover: scale 1.03 and brighter ring
    for (const [name, g] of Object.entries(this.locGroups)) {
      const target = this.hover === name ? 1.03 : 1;
      const s = lerp(g.scale.x, target, 1 - Math.exp(-dt * 10));
      g.scale.setScalar(s);
    }
    for (const [name, r] of Object.entries(this.rings)) {
      const st = this.locStates[name];
      const pulse = st === 'available' ? 0.5 + 0.5 * Math.sin(t * 3) : 0;
      const hov = this.hover === name ? 1 : 0;
      r.glow.material.opacity = (st === 'available' ? 0.25 + 0.35 * pulse : st === 'completed' ? 0.18 : 0) + hov * 0.35;
      r.ring.scale.setScalar(1 + (st === 'available' ? pulse * 0.05 : 0) + hov * 0.04);
      r.ring.visible = r.glow.visible = this.mode === 'hub' || this.mode === 'final';
    }
    // Colin's window glow pulses when his mission is available
    const cwState = this.locStates.colinsWindow;
    const cwPulse = cwState === 'available' ? 0.5 + 0.5 * Math.sin(t * 3) : 0;
    this.colinGlass.emissiveIntensity = 0.45 + cwPulse * 0.6 + (this.hover === 'colinsWindow' ? 0.4 : 0);
    this.colinGlow.material.opacity = 0.3 + cwPulse * 0.4;

    // portal
    this.portalUniforms.uTime.value = t;
    if (this.portalParticles.visible) {
      const arr = this.portalParticles.geometry.attributes.position.array;
      this.portalParticles.userData.seeds.forEach(([a, r, h], i) => {
        const ang = a + t * (0.4 + h * 0.4);
        arr[i * 3] = Math.cos(ang) * r;
        arr[i * 3 + 1] = 3 + Math.sin(ang) * r;
        arr[i * 3 + 2] = Math.sin(t * 2 + i) * 0.3;
      });
      this.portalParticles.geometry.attributes.position.needsUpdate = true;
    }

    // fountain drops
    const on = this.fountainOn || 0;
    this.dropPoints.material.opacity = on * 0.85;
    if (on > 0.01) {
      const { N, pos, vel, age } = this.drops;
      for (let i = 0; i < N; i++) {
        age[i] += dt;
        if (age[i] > 1.4 || pos[i * 3 + 1] < 0.6) {
          age[i] = 0;
          const a = Math.random() * Math.PI * 2;
          pos[i * 3] = 0; pos[i * 3 + 1] = 2.9; pos[i * 3 + 2] = 0;
          vel[i * 3] = Math.cos(a) * sr(0.6, 1.1); vel[i * 3 + 1] = sr(1.8, 2.6); vel[i * 3 + 2] = Math.sin(a) * sr(0.6, 1.1);
        }
        vel[i * 3 + 1] -= 6 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      this.dropPoints.geometry.attributes.position.needsUpdate = true;
    }

    // birds
    let birdCount = 0;
    if (this.mode === 'landing') birdCount = 4;
    else if (this.mode === 'final') birdCount = 16;
    else if (this.mode === 'hub') birdCount = Math.round(12 * smooth((this.stageValue - 3) / 1));
    this.birds.forEach((b, i) => {
      b.visible = i < birdCount;
      if (!b.visible) return;
      const u = b.userData;
      const a = u.phase + t * u.speed;
      const cz = this.mode === 'landing' ? u.cz + 22 : u.cz;
      b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.phase) * 0.6, cz + Math.sin(a) * u.r);
      b.rotation.y = -a + (u.speed > 0 ? 0 : Math.PI);
      const flap = Math.sin(t * 11 + u.phase) * 0.7;
      u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
    });

    // butterflies
    const bfOn = this.mode === 'landing' || this.mode === 'final' || (this.mode === 'hub' && this.stageValue > 1.6);
    this.butterflies.forEach((bf, i) => {
      bf.visible = bfOn && (this.mode !== 'hub' || i < 2 + this.stageValue);
      if (!bf.visible) return;
      const u = bf.userData;
      const tt = t * u.sp + u.phase;
      const cx = this.mode === 'landing' ? (i - 3) * 2.5 : u.cx;
      const cz = this.mode === 'landing' ? 22 + (i % 3) : u.cz;
      bf.position.set(cx + Math.sin(tt) * u.ax * (this.mode === 'landing' ? 0.4 : 1), 1.2 + Math.sin(tt * 2.3) * 0.6 + (this.mode === 'landing' ? 1.2 : 0), cz + Math.sin(tt * 0.7) * u.az * 0.5);
      bf.rotation.y = Math.cos(tt) > 0 ? 0.5 : -2.6;
      const f = Math.sin(t * 16 + u.phase) * 0.9;
      u.wl.rotation.z = f; u.wr.rotation.z = -f;
    });

    // falling leaves / petals
    const dd = new THREE.Object3D();
    const showLeaves = this.mode !== 'digital';
    this.leaves.visible = showLeaves;
    if (showLeaves) {
      this.leafData.forEach((l, i) => {
        l.y -= l.vy * dt * (reduced ? 0.3 : 1);
        l.rot += dt * l.sp;
        if (l.y < 0.05) Object.assign(l, this._newLeaf());
        dd.position.set(l.x + Math.sin(t * l.sp + l.ph) * 0.6, l.y, l.z + Math.cos(t * 0.5 + l.ph) * 0.3);
        dd.rotation.set(l.rot, l.rot * 0.7, l.rot * 0.3);
        dd.updateMatrix();
        this.leaves.setMatrixAt(i, dd.matrix);
      });
      this.leaves.instanceMatrix.needsUpdate = true;
    }

    // mist and sun rays
    const gloom = this.mode === 'hub' ? 1 - this.stageValue / 5 : this.mode === 'landing' ? 0.6 : 0.15;
    this.mist.forEach(s => {
      const u = s.userData;
      s.position.x = u.base + Math.sin(t * u.sp + u.ph) * 3;
      s.material.opacity = this.mode === 'digital' ? 0 : u.op * (0.4 + gloom);
    });
    const rays = this.mode === 'digital' ? 0 : this.mode === 'hub' ? 0.4 + this.stageValue / 5 : 1;
    this.shafts.forEach(m => { m.material.opacity = (0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.5 + m.userData.ph))) * rays; });

    // digital floating objects
    if (this.digital.visible) {
      for (const o of this.digital.children) {
        const u = o.userData;
        if (!u.base) continue;
        o.position.y = u.base.y + Math.sin(t * u.sp + u.ph) * 0.4;
        if (o.isGroup) o.rotation.y += dt * 0.3;
      }
    }

    // collectibles sparkle
    for (const c of Object.values(this.collectibles)) {
      if (!c.group.visible || c.found) continue;
      const u = c.group.userData;
      u.spark.material.opacity = 0.35 + 0.35 * Math.sin(t * 2.4 + u.ph);
      u.mesh.position.y = 0.06 * Math.sin(t * 1.8 + u.ph);
    }

    // bursts
    for (const b of [...this.bursts]) {
      b.age += dt;
      const arr = b.pts.geometry.attributes.position.array;
      b.vel.forEach((v, i) => {
        v.y -= 4 * dt;
        arr[i * 3] += v.x * dt; arr[i * 3 + 1] += v.y * dt; arr[i * 3 + 2] += v.z * dt;
      });
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - b.age / 2);
      b.light.intensity = Math.max(0, 30 * (1 - b.age / 1.2));
      if (b.age > 2.2) {
        this.scene.remove(b.pts, b.light);
        b.pts.geometry.dispose();
        this.bursts.splice(this.bursts.indexOf(b), 1);
      }
    }

    // robin hops toward its target
    const ru = this.robin.userData;
    const dist = this.robin.position.distanceTo(ru.target);
    ru.hopT += dt;
    if (dist > 0.1) {
      const dir = ru.target.clone().sub(this.robin.position).setY(0).normalize();
      this.robin.position.addScaledVector(dir, Math.min(dist, dt * 2.2));
      this.robin.position.y = 0.18 + Math.abs(Math.sin(ru.hopT * 10)) * 0.25;
      this.robin.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      this.robin.position.y = 0.18 + (Math.sin(ru.hopT * 1.3) > 0.95 ? 0.15 : 0);
      ru.head.rotation.x = Math.sin(t * 4) > 0.6 ? 0.5 : 0;
    }
    this.robin.visible = this.mode === 'hub' || this.mode === 'final';

    this._updateCharacters(dt, t);
  }

  _updateCharacters(dt, t) {
    for (const [name, c] of Object.entries(this.characters)) {
      const u = c.userData;
      if (name === 'colinWindow') {
        const happy = u.mood === 'happy' || u.mood === 'hopeful' || u.mood === 'surprised';
        u.head.rotation.x = lerp(u.head.rotation.x, happy ? -0.1 : 0.4, 1 - Math.exp(-dt * 3));
        c.position.y = 10.0 + (happy ? Math.abs(Math.sin(t * 4)) * 0.05 : 0);
        continue;
      }
      if (!c.visible) continue;
      if (u.moodT > 0) { u.moodT -= dt; if (u.moodT <= 0) u.mood = 'idle'; }
      const [al, ar] = u.arms;
      const [ll, lr] = u.legs;
      let headX = 0, headZ = Math.sin(t * 0.6 + c.id) * 0.08, armL = 0.12, armR = -0.12, armLx = 0, armRx = 0, bob = 0, legSwing = 0;
      const sitting = u.sitting && name === 'colin' && this.mode !== 'final';

      if (u.walk && u.mood === 'idle' && this.mode !== 'final' && !motion.reduced) {
        // Mary walks slowly back and forth
        u.walk.t += dt * 0.12;
        const k = (Math.sin(u.walk.t * Math.PI * 2) + 1) / 2;
        const p = u.walk.a.clone().lerp(u.walk.b, k);
        const dir = Math.cos(u.walk.t * Math.PI * 2) > 0 ? 1 : -1;
        const vec = u.walk.b.clone().sub(u.walk.a).multiplyScalar(dir);
        c.position.x = p.x; c.position.z = p.z;
        c.rotation.y = lerp(c.rotation.y, Math.atan2(vec.x, vec.z), 0.1);
        legSwing = Math.sin(t * 6) * 0.45;
        armLx = -legSwing * 0.6; armRx = legSwing * 0.6;
        bob = Math.abs(Math.sin(t * 6)) * 0.03;
      }
      switch (u.mood) {
        case 'happy': bob = Math.abs(Math.sin(t * 7)) * 0.12; armL = 2.4; armR = -2.4; headX = -0.15; break;
        case 'hopeful': headX = -0.2; armLx = -0.5; armRx = -0.5; break;
        case 'sad': headX = 0.45; armL = 0.05; armR = -0.05; break;
        case 'angry': armL = 0.5; armR = -0.5; headX = 0.1; bob = Math.abs(Math.sin(t * 12)) * 0.03; break;
        case 'surprised': armL = 1.2; armR = -1.2; headX = -0.25; bob = 0.06; break;
        case 'worried': headX = 0.25; armLx = -0.9; armRx = -0.9; headZ = Math.sin(t * 2) * 0.12; break;
        case 'thinking': armRx = -2.2; armR = 0.4; headZ = 0.25; headX = 0.1; break;
        case 'wave': armR = -2.6 + Math.sin(t * 10) * 0.4; break;
        case 'water': armRx = -1.2; armLx = -1.2; headX = 0.35; break;
        default:
          if (name === 'dickon') { headX = 0.25 + Math.sin(t * 0.5) * 0.1; armRx = -0.4 + Math.sin(t * 1.4) * 0.3; }
      }
      if (sitting) { ll.rotation.x = lr.rotation.x = -1.4; }
      else { ll.rotation.x = legSwing; lr.rotation.x = -legSwing; }
      al.rotation.z = lerp(al.rotation.z, armL, 0.15);
      ar.rotation.z = lerp(ar.rotation.z, armR, 0.15);
      al.rotation.x = lerp(al.rotation.x, armLx, 0.15);
      ar.rotation.x = lerp(ar.rotation.x, armRx, 0.15);
      u.headG.rotation.x = lerp(u.headG.rotation.x, headX, 0.1);
      u.headG.rotation.z = lerp(u.headG.rotation.z, headZ, 0.1);
      const baseY = sitting ? 0.25 : 0;
      c.position.y = baseY + bob + Math.sin(t * 1.5 + c.id) * 0.01;
    }
  }
}

export async function createWorld(container, opts) {
  const world = new GardenWorld(container, opts);
  await world.build(opts?.onProgress);
  return world;
}
