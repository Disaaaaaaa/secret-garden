/*
  ui.js — small helpers for the interface: HUD, toasts, modals,
  achievement popups and the confirm dialog.
*/
import { Sound } from './audio.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escape text before putting it into HTML. */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function html(el, markup) {
  el.innerHTML = markup;
  return el;
}

/* ---------- HUD ---------- */
export const HUD = {
  show(on) { $('#hud').hidden = !on; },
  setMission(eyebrow, title) {
    $('#hud-eyebrow').textContent = eyebrow;
    $('#hud-title').textContent = title;
  },
  setProgress(done, total, currentIndex) {
    $('#journey-label').textContent = `Journey ${done}/${total}`;
    const dots = $('#journey-dots');
    dots.innerHTML = '';
    dots.setAttribute('aria-label', `${done} of ${total} missions complete`);
    for (let i = 0; i < total + 1; i++) {
      const d = document.createElement('i');
      if (i < done) d.className = 'done';
      else if (i === currentIndex) d.className = 'current';
      d.title = i < total ? `Mission ${i + 1}` : 'Final Garden';
      dots.appendChild(d);
    }
  },
  setSeeds(n, bump = false) {
    const b = $('#seed-count');
    b.textContent = n;
    if (bump) {
      b.classList.remove('bump');
      void b.offsetWidth;
      b.classList.add('bump');
    }
  },
  setMuted(muted) {
    const btn = $('#btn-sound');
    btn.classList.toggle('muted', muted);
    btn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  }
};

/* ---------- Toasts & captions ---------- */
export function toast(message, ms = 3200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
}

let captionsOn = false;
let captionTimer = null;
export function setCaptions(on) { captionsOn = on; }
export function caption(text) {
  if (!captionsOn) return;
  const el = $('#caption');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Achievement popup (top corner, does not cover the screen) ---------- */
export function achievementPopup(ach) {
  const el = document.createElement('div');
  el.className = 'achievement';
  el.innerHTML = `<div class="ach-icon" aria-hidden="true">${esc(ach.icon)}</div>
    <div><small>Achievement unlocked</small><strong>${esc(ach.name)}</strong></div>`;
  $('#achievements').appendChild(el);
  Sound.achievement();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, 4200);
}

/* ---------- Modals ---------- */
let openModals = [];

export function modal({ title = '', body = '', wide = false, className = '', onClose, closable = true, label } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `<div class="modal paper ${wide ? 'modal-wide' : ''} ${className}" role="dialog" aria-modal="true" aria-label="${esc(label || title)}">
    ${closable ? '<button class="modal-close" aria-label="Close">×</button>' : ''}
    ${title ? `<h2>${esc(title)}</h2>` : ''}
    <div class="modal-body"></div>
  </div>`;
  const box = back.querySelector('.modal');
  const bodyEl = back.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  const lastFocus = document.activeElement;
  const close = () => {
    if (!back.isConnected) return;
    back.remove();
    openModals = openModals.filter(m => m !== api);
    lastFocus?.focus?.();
    onClose?.();
  };
  const api = { el: box, body: bodyEl, close, closable };
  if (closable) {
    back.querySelector('.modal-close').addEventListener('click', close);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  }
  $('#modal-root').appendChild(back);
  openModals.push(api);
  setTimeout(() => (box.querySelector('[autofocus]') || box.querySelector('button:not(.modal-close), input, select') || box).focus?.(), 50);
  return api;
}

export function closeTopModal() {
  const top = openModals[openModals.length - 1];
  if (top && top.closable) { top.close(); return true; }
  return false;
}

export function hasModal() { return openModals.length > 0; }

export function confirmDialog(text, { yes = 'Yes', no = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const m = modal({
      title: 'Are you sure?',
      label: text,
      body: `<p>${esc(text)}</p>
        <div class="modal-actions">
          <button class="btn btn-soft" data-no>${esc(no)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(yes)}</button>
        </div>`,
      onClose: () => { if (!answered) resolve(false); }
    });
    m.el.querySelector('[data-no]').addEventListener('click', () => { answered = true; m.close(); resolve(false); });
    m.el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; m.close(); resolve(true); });
  });
}

/** Wait for a click on an element (returns the event). */
export function once(el, type = 'click') {
  return new Promise(resolve => el.addEventListener(type, resolve, { once: true }));
}
