/*
  app.js — starts the platform.
  1) shows the loading screen  2) loads the data (JSON)
  3) builds the 3D garden (or a 2D map if 3D is not possible)  4) starts the game
*/
import { Storage } from './storage.js';
import { Game } from './game.js';
import { motion } from './animations.js';

const pctEl = document.getElementById('loader-pct');
let shown = 0;
function progress(p) {
  const target = Math.round(p * 100);
  if (target <= shown) return;
  shown = target;
  pctEl.textContent = target + '%';
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/* ---------- 2D fallback world (same functions as the 3D world) ---------- */
const FLAT_POS = {
  gardenGate: [50, 84], oldTree: [24, 58], roseGarden: [76, 58], colinsWindow: [36, 18],
  fountain: [50, 50], hiddenBench: [20, 30], digitalPortal: [80, 30], finalGarden: [56, 24]
};

class FlatWorld {
  constructor() {
    this.is3D = false;
    this.listeners = {};
    this.el = document.getElementById('fallback-map');
    this.el.hidden = false;
    this.el.classList.add('dim');
    const loop = () => { this.listeners.frame?.(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  on(evt, fn) { this.listeners[evt] = fn; }
  project(name) {
    const [x, y] = FLAT_POS[name];
    return { x: (x / 100) * window.innerWidth, y: (y / 100) * window.innerHeight, visible: true };
  }
  setGardenStage(n) {
    this.el.style.filter = `saturate(${0.45 + n * 0.11}) brightness(${0.8 + n * 0.04})`;
    return Promise.resolve();
  }
  setMode(mode) {
    this.el.style.filter = mode === 'digital' ? 'hue-rotate(60deg) saturate(.6) brightness(.7)' : mode === 'final' ? 'saturate(1.1) brightness(1.05)' : this.el.style.filter;
  }
  enterDigital() { this.setMode('digital'); return Promise.resolve(); }
  exitDigital() { this.setMode('hub'); }
  openGate({ onThrough } = {}) { onThrough?.(); return new Promise(r => setTimeout(r, motion.reduced ? 200 : 1600)); }
  approachGate() { return Promise.resolve(); }
  toOverview() { return Promise.resolve(); }
  focus() { return Promise.resolve(); }
  cameraTo() { return Promise.resolve(); }
  setGateOpen() {}
  setCollected() {}
  setLocationStates() {}
  setStoryProgress() {}
  setHover() {}
  setMood() {}
  celebrate() {}
  addPlant() {}
  pause() {}
  resume() {}
}

async function boot() {
  const settings = Storage.loadSettings();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !localStorage.getItem('sg_settings_v1')) settings.reduceMotion = true;
  motion.reduced = settings.reduceMotion;
  progress(0.02);

  let data;
  try {
    const [questions, missions, characters, garden] = await Promise.all([
      loadJSON('data/questions.json'),
      loadJSON('data/missions.json'),
      loadJSON('data/characters.json'),
      loadJSON('data/garden.json')
    ]);
    data = { questions, missions, characters, garden };
  } catch (err) {
    document.querySelector('.loader-text').textContent = 'The game files could not be loaded.';
    pctEl.innerHTML = 'Please open the project through a local web server (see README.md),<br>for example by double-clicking <b>start.command</b> (Mac) or <b>start.bat</b> (Windows).';
    pctEl.style.maxWidth = '520px';
    pctEl.style.lineHeight = '1.6';
    console.error(err);
    return;
  }
  progress(0.12);

  let world;
  if (webglAvailable()) {
    try {
      const mod = await import('./three-scene.js');
      progress(0.2);
      world = await mod.createWorld(document.getElementById('world'), {
        quality: settings.quality,
        onProgress: p => progress(0.2 + p * 0.78)
      });
    } catch (err) {
      console.warn('3D could not start, switching to the 2D map.', err);
      document.getElementById('world').innerHTML = '';
      world = null;
    }
  }
  if (!world) world = new FlatWorld();

  progress(1);
  const game = new Game({ data, world, settings });
  window.secretGarden = game; // handy for teachers / debugging in the console
  game.init();
  if (!world.is3D) {
    setTimeout(() => {
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = '3D is not available on this device, so the garden is shown as a 2D map.';
      document.getElementById('toasts').appendChild(t);
      setTimeout(() => t.remove(), 5000);
    }, 1200);
  }
  await new Promise(r => setTimeout(r, 350));
  document.getElementById('loader').classList.add('done');
}

boot();
