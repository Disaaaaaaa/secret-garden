/*
  animations.js — tweens and screen transitions.
  Uses GSAP when it is loaded; otherwise a small built-in tween.
  Every animation respects the "Reduce animations" setting.
*/

export const motion = { reduced: false, skipping: false };

const active = new Set();

const EASES = {
  linear: t => t,
  'power1.inOut': t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  'power2.inOut': t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  'power2.out': t => 1 - Math.pow(1 - t, 3),
  'power3.out': t => 1 - Math.pow(1 - t, 4),
  'back.out': t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  'sine.inOut': t => -(Math.cos(Math.PI * t) - 1) / 2
};

/**
 * Animate numeric properties of an object.
 * Returns a Promise that resolves when the animation ends.
 */
export function tween(target, to, { duration = 1, ease = 'power2.inOut', delay = 0, onUpdate } = {}) {
  if (motion.reduced) { duration = Math.min(duration, 0.2); delay = 0; }
  if (motion.skipping) { duration = 0; delay = 0; }
  return new Promise(resolve => {
    if (window.gsap) {
      let entry;
      const tw = window.gsap.to(target, {
        ...to,
        duration,
        delay,
        ease: ease === 'back.out' ? 'back.out(1.4)' : ease,
        onUpdate,
        onComplete: () => { active.delete(entry); resolve(); }
      });
      entry = { finish: () => tw.progress(1) };
      active.add(entry);
      return;
    }
    // Fallback tween without GSAP
    const from = {};
    for (const k of Object.keys(to)) from[k] = target[k];
    const fn = EASES[ease] || EASES['power2.inOut'];
    let start = null;
    let done = false;
    const entry = {
      finish: () => {
        if (done) return;
        done = true;
        for (const k of Object.keys(to)) target[k] = to[k];
        onUpdate?.();
        active.delete(entry);
        resolve();
      }
    };
    active.add(entry);
    if (duration + delay === 0) { entry.finish(); return; }
    const step = now => {
      if (done) return;
      if (start === null) start = now + delay * 1000;
      const p = Math.min(1, Math.max(0, (now - start) / (duration * 1000)));
      const e = fn(p);
      for (const k of Object.keys(to)) target[k] = from[k] + (to[k] - from[k]) * e;
      onUpdate?.();
      if (p < 1) requestAnimationFrame(step); else entry.finish();
    };
    requestAnimationFrame(step);
  });
}

/** Jump every running tween to its end (used by "Skip animation"). */
export function finishAll() {
  for (const e of [...active]) e.finish();
}

export function wait(ms) {
  if (motion.skipping) return Promise.resolve();
  if (motion.reduced) ms = Math.min(ms, 150);
  return new Promise(r => setTimeout(r, ms));
}

/* ---------- Screen transitions ---------- */
const LEAF_COLORS = ['#2d4733', '#3b5a40', '#6b7f45', '#4f6b3a', '#7d8f5a', '#24382a', '#58733f'];

/**
 * Cover the screen, run `middle()`, then reveal.
 * type: 'fade' | 'light' | 'leaf' | 'pixel'
 */
export async function transition(type, middle) {
  const root = document.getElementById('transition');
  root.innerHTML = '';
  root.classList.add('active');

  if (motion.reduced || type === 'fade' || type === 'light') {
    const el = document.createElement('div');
    el.className = 'tr-fade' + (type === 'light' ? ' light' : '');
    root.appendChild(el);
    await nextFrame();
    el.classList.add('on');
    await sleep(motion.reduced ? 120 : 650);
    await middle?.();
    el.classList.remove('on');
    await sleep(motion.reduced ? 120 : 700);
  } else if (type === 'leaf') {
    const leaves = [];
    const cols = 7, rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = document.createElement('div');
        el.className = 'tr-leaf';
        const size = Math.max(window.innerWidth, window.innerHeight) * 0.42;
        el.style.width = el.style.height = size + 'px';
        el.style.left = (c / (cols - 1)) * 100 + '%';
        el.style.top = (r / (rows - 1)) * 100 + '%';
        el.style.marginLeft = el.style.marginTop = -size / 2 + 'px';
        el.style.color = LEAF_COLORS[(r * cols + c) % LEAF_COLORS.length];
        const rot = Math.random() * 360;
        el.style.transform = `translateX(-120vw) rotate(${rot}deg) scale(.4)`;
        el.style.transition = `transform .75s cubic-bezier(.3,.7,.2,1) ${c * 0.05 + Math.random() * 0.08}s`;
        root.appendChild(el);
        leaves.push({ el, rot });
      }
    }
    await nextFrame();
    leaves.forEach(({ el, rot }) => { el.style.transform = `translateX(0) rotate(${rot + 40}deg) scale(1.15)`; });
    await sleep(1100);
    await middle?.();
    leaves.forEach(({ el, rot }) => { el.style.transform = `translateX(130vw) rotate(${rot + 120}deg) scale(.5)`; });
    await sleep(1150);
  } else if (type === 'pixel') {
    const cols = Math.ceil(window.innerWidth / 70), rows = Math.ceil(window.innerHeight / 70);
    const cells = [];
    const colors = ['#24403f', '#2f4f4c', '#3a5d55', '#2d4733', '#41665c', '#5f8f84'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = document.createElement('div');
        el.className = 'tr-pixel';
        el.style.left = (c * 100) / cols + '%';
        el.style.top = (r * 100) / rows + '%';
        el.style.width = 100 / cols + 0.2 + '%';
        el.style.height = 100 / rows + 0.2 + '%';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.transition = `opacity .25s ${Math.random() * 0.6}s`;
        root.appendChild(el);
        cells.push(el);
      }
    }
    await nextFrame();
    cells.forEach(el => { el.style.opacity = 1; });
    await sleep(950);
    await middle?.();
    cells.forEach(el => { el.style.transition = `opacity .25s ${Math.random() * 0.6}s`; el.style.opacity = 0; });
    await sleep(950);
  }
  root.innerHTML = '';
  root.classList.remove('active');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
export function nextFrame() { return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }

/** "+2 Seeds" floating text at a screen position. */
export function seedFloat(x, y, text) {
  const el = document.createElement('div');
  el.className = 'seed-float';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

/** Count a number up inside an element. */
export function countUp(el, to, { duration = 1.2, suffix = '%' } = {}) {
  const obj = { v: 0 };
  return tween(obj, { v: to }, {
    duration,
    ease: 'power2.out',
    onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; }
  }).then(() => { el.textContent = Math.round(to) + suffix; });
}
