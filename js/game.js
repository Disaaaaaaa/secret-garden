/*
  game.js — the journey:
  Landing → Avatar → Before → Garden Gate → Map → Missions → Digital Garden
  → Garden Restoration → After → Empathy Pyramid → Final Garden
*/
import { $, $$, esc, HUD, toast, caption, setCaptions, achievementPopup, modal, closeTopModal, hasModal, confirmDialog } from './ui.js';
import { Storage, buildRecord, newParticipantId } from './storage.js';
import { Sound } from './audio.js';
import { tween, wait, transition, motion, finishAll, seedFloat, countUp } from './animations.js';
import { VALUES, calc, shuffle, makeAnswer, improvement, strongestDecision } from './scoring.js';
import { portrait, avatarSVG, AVATARS, medalSVG, plantSVG } from './portraits.js';
import { runMission } from './missions.js';
import { planting } from './minigames.js';

const LOCATION_ICONS = {
  gardenGate: '🚪', oldTree: '🌳', roseGarden: '🌹', colinsWindow: '🪟',
  fountain: '⛲', hiddenBench: '🪑', digitalPortal: '🌀', finalGarden: '🌸'
};
const STATE_TEXT = { locked: '🔒 Locked', available: '✨ Ready to explore', completed: '✓ Completed', info: '' };
const DEMO_SAMPLE = {
  before: { respect: 55, understanding: 50, kindness: 61, caring: 52, compassion: 47 },
  after: { respect: 64, understanding: 69, kindness: 70, caring: 63, compassion: 60 }
};

export class Game {
  constructor({ data, world, settings }) {
    this.data = data;
    this.world = world;
    this.settings = settings;
    this.stageEl = $('#stage');
    this.state = null;
    this.busy = false;
    this.pins = {};
  }

  /* ================= setup ================= */
  init() {
    this.applySettings();
    this.missions = this.data.missions.missions;
    this.buildPins();
    this.bindHUD();
    this.bindKeys();

    this.world.on('frame', () => this.updatePins());
    this.world.on('hover', (h, pos) => this.onWorldHover(h, pos));
    this.world.on('hovermove', (h, pos) => this.moveLabel(pos));
    this.world.on('select', name => this.onSelect(name));
    this.world.on('collect', id => this.collect(id));
    this.world.on('sound', name => Sound[name]?.());

    window.addEventListener('offline', () => toast('Your progress is safe. You can continue offline.', 4500));
    window.addEventListener('online', () => { toast('You are back online.'); Storage.syncPending(); });
    Storage.syncPending();

    this.showLanding();
  }

  applySettings() {
    const s = this.settings;
    document.body.classList.toggle('reduce-motion', s.reduceMotion);
    document.body.classList.toggle('large-text', s.largeText);
    motion.reduced = s.reduceMotion;
    Sound.enabled = s.sound;
    Sound.setEnabled(s.sound);
    Sound.setMusic(s.music);
    HUD.setMuted(!s.sound);
    setCaptions(s.captions);
    Sound.onCaption = caption;
    Storage.saveSettings(s);
  }

  newState(mode = 'full') {
    return {
      version: 1,
      participantId: newParticipantId(mode === 'demo' ? 'DEMO' : 'P'),
      nickname: '',
      grade: '',
      avatar: 1,
      mode,
      stage: 'avatar',
      beforeAnswers: [],
      missionAnswers: [],
      digitalAnswers: [],
      afterAnswers: [],
      completedMissions: [],
      seeds: 0,
      seedsEarned: 0,
      seedsByValue: { respect: 0, understanding: 0, kindness: 0, caring: 0, compassion: 0 },
      planted: [],
      collectibles: [],
      achievements: [],
      thenNow: [],
      startedAt: new Date().toISOString(),
      completedAt: null
    };
  }

  save() {
    if (!this.state) return;
    // Demo Mode never replaces a student's saved journey
    if (this.state.mode !== 'demo') Storage.saveState(this.state);
    if (this.state.stage !== 'avatar') Storage.upsertRecord(buildRecord(this.state));
  }

  missionList() {
    if (this.state?.mode === 'demo') return this.missions.filter(m => m.id === 'm3' || m.id === 'm5');
    return this.missions;
  }

  /* ================= landing ================= */
  showLanding() {
    const saved = Storage.loadState();
    $('#landing').hidden = false;
    $('#landing').classList.remove('leaving');
    HUD.show(false);
    $('#pins').hidden = true;
    const cont = $('#btn-continue');
    cont.hidden = !(saved && saved.stage && saved.stage !== 'avatar' && saved.mode === 'full');
    if (!cont.hidden) cont.textContent = saved.stage === 'final' ? `Return to ${saved.nickname}'s garden` : `Continue ${saved.nickname}'s journey`;

    $('#btn-enter').onclick = async () => {
      if (saved && saved.mode === 'full' && saved.stage !== 'avatar' && saved.stage !== 'final') {
        const ok = await confirmDialog('You already have a journey in progress. Start a new journey? The old one will be reset.', { yes: 'Start new journey', no: 'Cancel' });
        if (!ok) return;
      }
      Sound.init();
      this.state = this.newState('full');
      this.leaveLanding();
      await this.world.approachGate();
      this.showAvatar();
    };
    cont.onclick = () => {
      Sound.init();
      this.state = saved;
      this.leaveLanding();
      this.resume();
    };
    $('#btn-demo').onclick = () => this.startDemo();
    $('#btn-about').onclick = () => this.showAbout();
    $('#btn-research-mode').onclick = () => this.showResearchMode();
  }

  leaveLanding() {
    const l = $('#landing');
    l.classList.add('leaving');
    setTimeout(() => { l.hidden = true; }, 700);
  }

  async resume() {
    const s = this.state;
    if (s.stage === 'before') { await this.world.approachGate(); return this.runBefore(); }
    if (s.stage === 'gate') return this.runGate();
    this.world.setGateOpen(true);
    this.world.setCollected(s.collectibles);
    (s.planted || []).forEach(p => this.world.addPlant?.(p.plot, p.type, false));
    this.world.setStoryProgress?.(s.completedMissions);
    if (s.stage === 'final' || s.stage === 'results') {
      this.world.setMode('final');
      this.world.setGardenStage(5, false);
      await this.world.toOverview(2);
      if (s.stage === 'results') return this.showResults();
      return this.showFinal();
    }
    this.world.setMode('hub');
    this.world.setGardenStage(this.gardenStage(), false);
    await this.world.toOverview(2.2);
    this.enterHub();
    if (s.stage === 'after') this.startAfter();
  }

  async startDemo() {
    Sound.init();
    this.state = this.newState('demo');
    this.state.nickname = 'Demo Explorer';
    this.state.grade = 'demo';
    this.state.stage = 'gate';
    this.leaveLanding();
    toast('Demo Mode: one story mission, one digital situation and the Empathy Pyramid (3–5 minutes).', 5000);
    await this.runGate();
  }

  /* ================= avatar ================= */
  showAvatar() {
    HUD.show(false);
    let chosen = null;
    this.stageEl.innerHTML = `<div class="screen-center"><div class="card paper" role="form" aria-label="Player profile">
      <span class="eyebrow-dark">Player Profile</span>
      <h2>Choose your explorer</h2>
      <p class="lead">You don't need your real name here. Pick an explorer and a nickname.</p>
      <div class="avatar-grid">${AVATARS.map(a => `<button class="avatar-option" data-id="${a.id}" aria-pressed="false">${avatarSVG(a.id)}<span>${esc(a.name)}</span></button>`).join('')}</div>
      <div class="field">
        <label for="nick">Choose a nickname</label>
        <div class="field-row">
          <input id="nick" class="input" maxlength="16" autocomplete="off" placeholder="e.g. Robin42">
          <button class="btn btn-soft" id="nick-random" type="button" title="Suggest a nickname">🎲</button>
        </div>
        <p class="hint">Please do not use your real name. Your nickname is used instead of a name in the research data.</p>
      </div>
      <div class="field">
        <label for="grade">Your grade</label>
        <select id="grade" class="select">
          <option value="">Choose…</option>
          ${[5, 6, 7, 8, 9, 10].map(g => `<option value="${g}">Grade ${g}</option>`).join('')}
          <option value="other">Other</option>
        </select>
      </div>
      <div class="card-actions"><button class="btn btn-primary" id="avatar-go" disabled>Continue ›</button></div>
    </div></div>`;
    const go = $('#avatar-go');
    const nick = $('#nick');
    const check = () => { go.disabled = !(chosen && nick.value.trim().length >= 2); };
    $$('.avatar-option').forEach(b => b.addEventListener('click', () => {
      $$('.avatar-option').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      chosen = Number(b.dataset.id);
      Sound.click();
      check();
    }));
    nick.addEventListener('input', () => { nick.value = nick.value.replace(/[^\p{L}\p{N} _-]/gu, ''); check(); });
    $('#nick-random').addEventListener('click', () => {
      const a = ['Robin', 'Rose', 'Ivy', 'Fern', 'Sparrow', 'Moss', 'Willow', 'Clover', 'Wren', 'Maple'];
      nick.value = a[Math.floor(Math.random() * a.length)] + Math.floor(10 + Math.random() * 90);
      check();
    });
    go.addEventListener('click', () => {
      this.state.avatar = chosen;
      this.state.nickname = nick.value.trim().slice(0, 16);
      this.state.grade = $('#grade').value || 'not given';
      this.state.stage = 'before';
      this.save();
      this.runBefore();
    });
  }

  /* ================= Before / After ================= */
  async runBefore() {
    HUD.show(true);
    HUD.setMission('Before We Enter', 'Quick Choices');
    this.refreshHUD();
    $('#pins').hidden = true;
    const qs = this.data.questions.before;
    const startAt = this.state.beforeAnswers.length;
    if (startAt === 0) {
      await this.introCard({
        eyebrow: 'Before We Enter',
        title: 'Quick Choices',
        text: 'Before you open the gate, make a few quick choices. There are no right or wrong answers — just choose what you would most likely do.',
        button: 'Start'
      });
    }
    await this.askQuestions(qs, 'before', 'Before We Enter · Quick Choices');
    this.state.stage = 'gate';
    this.save();
    this.runGate();
  }

  introCard({ eyebrow, title, text, button }) {
    this.stageEl.innerHTML = `<div class="screen-center dim"><div class="card paper">
      <span class="eyebrow-dark">${esc(eyebrow)}</span><h2>${esc(title)}</h2><p class="lead">${esc(text)}</p>
      <div class="card-actions"><button class="btn btn-primary" data-go>${esc(button)} ›</button></div></div></div>`;
    const b = this.stageEl.querySelector('[data-go]');
    setTimeout(() => b.focus(), 50);
    return new Promise(r => b.addEventListener('click', () => { Sound.click(); r(); }, { once: true }));
  }

  async askQuestions(qs, kind, label) {
    const key = kind === 'before' ? 'beforeAnswers' : 'afterAnswers';
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (this.state[key].some(a => a.qid === q.id)) continue;
      const opts = shuffle(q.options);
      this.stageEl.innerHTML = `<div class="screen-center dim"><div class="card paper" role="group" aria-label="Situation ${i + 1} of ${qs.length}">
        <div class="quiz-head">
          <span class="eyebrow-dark" style="margin:0">${esc(label)}</span>
          <span class="quiz-count">${i + 1} / ${qs.length}</span>
        </div>
        <div class="quiz-progress" aria-hidden="true">${qs.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'current' : ''}"></i>`).join('')}</div>
        <p class="situation">${esc(q.text)}</p>
        <div class="choices">${opts.map((o, k) => `<button class="choice" data-id="${o.id}"><span class="key">${String.fromCharCode(65 + k)}</span><span>${esc(o.text)}</span></button>`).join('')}</div>
        <p class="hint" id="q-saved" aria-live="polite">&nbsp;</p>
      </div></div>`;
      setTimeout(() => this.stageEl.querySelector('.choice')?.focus(), 60);
      const btn = await new Promise(res => $$('.choice', this.stageEl).forEach(b => b.addEventListener('click', () => res(b), { once: true })));
      const option = q.options.find(o => o.id === btn.dataset.id);
      this.recordAnswer(kind, makeAnswer(q, option, { order: opts.map(o => o.id) }));
      this.stageEl.querySelector('.choices').classList.add('locked');
      btn.classList.add('picked');
      $('#q-saved').innerHTML = '<span class="saved-leaf">🍃 Choice saved</span>';
      Sound.click();
      await wait(550);
    }
    this.stageEl.innerHTML = '';
  }

  /* ================= Garden Gate cinematic ================= */
  async runGate() {
    HUD.show(false);
    this.stageEl.innerHTML = '';
    const skip = $('#skip-anim');
    skip.hidden = false;
    skip.onclick = () => { motion.skipping = true; finishAll(); };
    const quotes = this.data.garden.quotes;
    await this.world.openGate({
      onThrough: () => {
        this.stageEl.innerHTML = `<div class="quote-overlay"><p>${esc(quotes[0])}</p></div>`;
      }
    });
    motion.skipping = false;
    skip.hidden = true;
    await wait(500);
    this.stageEl.innerHTML = '';
    this.state.stage = 'hub';
    this.save();
    this.world.setMode('hub');
    this.world.setCollected(this.state.collectibles);
    this.enterHub(true);
  }

  /* ================= Hub (3D garden map) ================= */
  gardenStage() {
    const done = this.state.completedMissions;
    if (this.state.mode === 'demo') return done.includes('m5') ? 5 : done.includes('m3') ? 3 : 0;
    return Math.min(5, done.length);
  }

  enterHub(first = false) {
    this.busy = false;
    this.stageEl.innerHTML = '';
    HUD.show(true);
    HUD.setMission(this.state.mode === 'demo' ? 'Demo Mode' : 'The Secret Garden', this.state.stage === 'final' ? 'Restored Garden' : 'Garden Map');
    this.refreshHUD();
    this.updateMap();
    $('#pins').hidden = false;
    this.world.interactive = true;
    Sound.setMode('garden');
    if (first) {
      setTimeout(() => toast('Click a glowing place in the garden to begin your journey.', 4500), 400);
    }
  }

  refreshHUD() {
    const list = this.missionList();
    const done = list.filter(m => this.state.completedMissions.includes(m.id)).length;
    HUD.setProgress(done, list.length, done);
    HUD.setSeeds(this.state.seeds);
  }

  hudSeeds(bump) { HUD.setSeeds(this.state.seeds, bump); }

  locationState(name) {
    const s = this.state;
    const list = this.missionList();
    const m = list.find(x => x.location === name);
    if (m) {
      if (s.completedMissions.includes(m.id)) return 'completed';
      const next = list.find(x => !s.completedMissions.includes(x.id));
      return next && next.id === m.id ? 'available' : 'locked';
    }
    if (this.missions.some(x => x.location === name)) return 'locked';
    if (name === 'fountain') return s.completedMissions.length === 0 ? 'locked' : (s.planted?.length ? 'info' : 'available');
    if (name === 'finalGarden') {
      if (s.completedAt) return 'completed';
      return list.every(x => s.completedMissions.includes(x.id)) ? 'available' : 'locked';
    }
    return 'info';
  }

  updateMap() {
    const states = {};
    for (const name of Object.keys(LOCATION_ICONS)) states[name] = this.locationState(name);
    this.locStates = states;
    this.world.setLocationStates(states);
    for (const [name, pin] of Object.entries(this.pins)) {
      const st = states[name];
      pin.className = `pin is-${st}`;
      pin.querySelector('.pin-badge').textContent = st === 'locked' ? '🔒' : st === 'completed' ? '✓' : st === 'available' ? '!' : 'i';
      pin.setAttribute('aria-label', `${this.data.garden.locations[name].action}. ${STATE_TEXT[st]}`);
    }
  }

  buildPins() {
    const nav = $('#pins');
    nav.innerHTML = '';
    for (const [name, icon] of Object.entries(LOCATION_ICONS)) {
      const b = document.createElement('button');
      b.className = 'pin';
      b.dataset.id = name;
      b.innerHTML = `<span class="pin-dot"><span aria-hidden="true">${icon}</span><span class="pin-badge" aria-hidden="true"></span></span><span class="pin-name">${esc(this.data.garden.locations[name].name)}</span>`;
      b.addEventListener('click', () => this.onSelect(name));
      b.addEventListener('mouseenter', () => { this.world.setHover?.(name); this.showLabel({ kind: 'location', id: name }, null, b); });
      b.addEventListener('mouseleave', () => { this.world.setHover?.(null); this.hideLabel(); });
      b.addEventListener('focus', () => { this.world.setHover?.(name); this.showLabel({ kind: 'location', id: name }, null, b); });
      b.addEventListener('blur', () => { this.world.setHover?.(null); this.hideLabel(); });
      nav.appendChild(b);
      this.pins[name] = b;
    }
  }

  updatePins() {
    if ($('#pins').hidden) return;
    for (const [name, pin] of Object.entries(this.pins)) {
      const p = this.world.project(name);
      pin.classList.toggle('offscreen', !p.visible);
      const x = Math.max(34, Math.min(window.innerWidth - 34, p.x));
      pin.style.transform = `translate(${Math.round(x - 22)}px, ${Math.round(p.y - 22)}px)`;
    }
  }

  onWorldHover(h, pos) {
    if (!h || $('#pins').hidden) { this.world.setHover?.(null); this.hideLabel(); return; }
    if (h.kind === 'location') this.world.setHover?.(h.id);
    this.showLabel(h, pos);
  }

  showLabel(h, pos, pinEl) {
    const label = $('#hover-label');
    if (h.kind === 'collectible') {
      label.innerHTML = 'Something is hidden here…<small>Click to pick it up</small>';
    } else {
      const st = this.locStates?.[h.id] || 'info';
      label.innerHTML = `${esc(this.data.garden.locations[h.id].action)}${STATE_TEXT[st] ? `<small>${STATE_TEXT[st]}</small>` : ''}`;
    }
    label.hidden = false;
    if (pinEl) {
      const r = pinEl.getBoundingClientRect();
      this.moveLabel({ x: r.left + r.width / 2, y: r.top });
    } else if (pos) this.moveLabel(pos);
  }

  moveLabel(pos) {
    if (!pos) return;
    const label = $('#hover-label');
    label.style.left = pos.x + 'px';
    label.style.top = pos.y - 8 + 'px';
  }

  hideLabel() { $('#hover-label').hidden = true; }

  async onSelect(name) {
    if (this.busy || hasModal() || $('#pins').hidden) return;
    const st = this.locationState(name);
    this.hideLabel();
    Sound.click();
    const mission = this.missionList().find(m => m.location === name);
    if (st === 'locked') {
      const pin = this.pins[name];
      pin.animate?.([{ transform: pin.style.transform + ' translateX(-4px)' }, { transform: pin.style.transform + ' translateX(4px)' }, { transform: pin.style.transform }], { duration: 300 });
      if (this.missions.some(m => m.location === name) && !mission) toast('This place is not part of Demo Mode.');
      else if (mission || this.missions.some(m => m.location === name)) {
        const next = this.missionList().find(m => !this.state.completedMissions.includes(m.id));
        toast(next ? `Complete “${next.title}” first.` : 'Locked.');
      } else if (name === 'fountain') toast('Earn Empathy Seeds in your first mission, then plant them here.');
      else if (name === 'finalGarden') toast('Complete all missions to open the Final Garden.');
      return;
    }
    if (mission && st === 'available') return this.startMission(mission);
    if (mission && st === 'completed') return this.showMissionMemory(mission);
    if (name === 'fountain') return this.openPlanting();
    if (name === 'finalGarden') return st === 'completed' ? this.showResults(true) : this.startAfter();
    if (name === 'gardenGate') return this.showGateInfo();
  }

  /* ================= missions ================= */
  async startMission(mission) {
    this.busy = true;
    this.world.interactive = false;
    $('#pins').hidden = true;
    const list = this.missionList();
    const index = list.indexOf(mission) + 1;
    HUD.setMission(`Mission ${index} of ${list.length}`, mission.title);
    const seedsBefore = { seeds: this.state.seeds, earned: this.state.seedsEarned, byValue: { ...this.state.seedsByValue } };

    if (mission.digital) {
      const go = await this.portalApproach();
      if (!go) { await this.world.toOverview(1.4); this.enterHub(); return; }
      Sound.pixels();
      await transition('pixel', async () => {
        await this.world.enterDigital();
        Sound.setMode('digital');
        HUD.setMission('Digital Garden', mission.title);
      });
    } else {
      this.world.focus(mission.location, 1.6);
    }

    const completed = await runMission(this, mission, { demo: this.state.mode === 'demo' });

    if (mission.digital) {
      Sound.pixels();
      await transition('pixel', async () => {
        this.world.exitDigital();
        Sound.setMode('garden');
        this.world.setMode('hub');
        await this.world.focus('digitalPortal', 0.01);
      });
    }
    if (!completed) {
      Object.assign(this.state, { seeds: seedsBefore.seeds, seedsEarned: seedsBefore.earned, seedsByValue: seedsBefore.byValue });
      this.clearMissionAnswers(mission.id, mission.steps);
      this.save();
      await this.world.toOverview(1.4);
      this.enterHub();
      return;
    }
    await this.completeMission(mission);
  }

  portalApproach() {
    return new Promise(async resolve => {
      await this.world.focus('digitalPortal', 1.6);
      if (this.world.is3D) await this.world.cameraTo?.({ pos: { x: 11.4, y: 3.4, z: -5.4 }, look: { x: 13, y: 3, z: -11 } }, 1.4);
      this.stageEl.innerHTML = `<div class="portal-cta">
        <p>The portal shimmers. The garden is about to change…</p>
        <button class="btn btn-gold btn-lg" data-enter>Enter the Digital Garden</button>
        <button class="btn btn-ghost btn-sm" data-back>Back to the map</button>
      </div>`;
      const enter = this.stageEl.querySelector('[data-enter]');
      setTimeout(() => enter.focus(), 50);
      enter.addEventListener('click', () => { this.stageEl.innerHTML = ''; resolve(true); });
      this.stageEl.querySelector('[data-back]').addEventListener('click', () => { this.stageEl.innerHTML = ''; resolve(false); });
    });
  }

  async completeMission(mission) {
    const s = this.state;
    if (!s.completedMissions.includes(mission.id)) s.completedMissions.push(mission.id);
    this.save();
    this.world.setStoryProgress?.(s.completedMissions);
    this.refreshHUD();
    await this.world.toOverview(1.8);
    // Garden restoration
    Sound.grow();
    toast(`🌿 ${mission.stageText}`, 4200);
    this.updateMap();
    await this.world.setGardenStage(this.gardenStage(), true);

    if (s.completedMissions.length === 1) this.unlock('first_seed');
    if (mission.id === 'm3' && s.missionAnswers.some(a => a.mission === 'm3' && (a.scores.understanding || 0) >= 2)) this.unlock('good_listener');
    if (mission.id === 'm5') this.unlock('digital_helper');
    const all = this.missionList().every(m => s.completedMissions.includes(m.id));
    if (all) setTimeout(() => toast('🌸 The Final Garden is open! Visit it when you are ready.', 5000), 1200);
    else if (s.completedMissions.length === 1 && s.mode === 'full') setTimeout(() => toast('⛲ You can plant your Empathy Seeds by the Fountain.', 4500), 1600);
    this.enterHub();
  }

  clearMissionAnswers(missionId) {
    const s = this.state;
    s.missionAnswers = s.missionAnswers.filter(a => a.mission !== missionId && !String(a.qid).startsWith(missionId + '_'));
    s.digitalAnswers = s.digitalAnswers.filter(a => a.mission !== missionId);
  }

  recordAnswer(kind, answer) {
    const key = { before: 'beforeAnswers', after: 'afterAnswers', mission: 'missionAnswers', digital: 'digitalAnswers' }[kind];
    const arr = this.state[key];
    if (kind === 'mission' && !answer.mission) answer.mission = String(answer.qid).split('_')[0];
    const i = arr.findIndex(a => a.qid === answer.qid);
    if (i >= 0) arr[i] = answer; else arr.push(answer);
    this.save();
    if (kind === 'mission' || kind === 'digital') {
      const kind5 = [...this.state.missionAnswers, ...this.state.digitalAnswers].filter(a => (a.scores?.kindness || 0) > 0).length;
      if (kind5 >= 5) this.unlock('kind_gardener');
    }
  }

  addSeeds(n, value, x, y) {
    if (!n) return;
    const s = this.state;
    s.seeds += n;
    s.seedsEarned += n;
    if (value && s.seedsByValue[value] !== undefined) s.seedsByValue[value] += n;
    this.save();
    setTimeout(() => {
      HUD.setSeeds(s.seeds, true);
      Sound.seed();
    }, 450);
    if (x !== undefined) seedFloat(x, y, `+${n} Seed${n > 1 ? 's' : ''} 🌱`);
  }

  collect(id, { silent = false } = {}) {
    const s = this.state;
    if (!s || s.collectibles.includes(id)) return;
    s.collectibles.push(id);
    this.save();
    const c = this.data.garden.collectibles.find(x => x.id === id);
    if (!silent && id !== 'key') {
      Sound.chime();
      toast(`${c.icon} You found: ${c.name}! It is now in your Garden Journal.`, 3800);
    }
    if (this.data.garden.collectibles.every(x => s.collectibles.includes(x.id))) this.unlock('curious');
  }

  unlock(id) {
    const s = this.state;
    if (!s || s.achievements.includes(id)) return;
    s.achievements.push(id);
    this.save();
    const a = this.data.garden.achievements.find(x => x.id === id);
    if (a) setTimeout(() => achievementPopup(a), 900);
  }

  journalNote(type, step) {
    if (type === 'thenNow' && !this.state.thenNow.some(t => t.book === step.book)) {
      this.state.thenNow.push({ book: step.book, today: step.today });
      this.save();
    }
  }

  showMissionMemory(mission) {
    const ch = this.data.characters[mission.character];
    modal({
      title: mission.title,
      body: `<div class="char-card"><div class="portrait">${portrait(mission.character, 'happy')}</div>
        <div><h4>${esc(ch.name)}</h4><p>${esc(mission.summary)}</p></div></div>
        <p class="hint" style="margin-top:12px">✓ Mission complete. Your choices are saved in your Garden Journal.</p>`
    });
  }

  showGateInfo() {
    modal({
      title: 'The Garden Gate',
      body: `<p>This is where your journey began. Your “Quick Choices” are saved, and you will see them again at the very end.</p>
        <p class="story-text narration">“${esc(this.data.garden.quotes[0])}”</p>
        <p class="hint">Tip: some things are hidden in the corners of the garden. Look for a soft sparkle.</p>`
    });
  }

  async openPlanting() {
    this.busy = true;
    $('#pins').hidden = true;
    this.world.interactive = false;
    await this.world.focus('fountain', 1.4);
    HUD.setMission('Seed Planting', 'The Fountain Beds');
    await planting(this);
    await this.world.toOverview(1.4);
    this.enterHub();
  }

  /* ================= After → results ================= */
  async startAfter() {
    this.busy = true;
    $('#pins').hidden = true;
    this.world.interactive = false;
    await this.world.focus('finalGarden', 1.6);
    if (this.state.mode === 'demo') return this.showResults();
    this.state.stage = 'after';
    this.save();
    HUD.setMission('Final Garden', 'One Last Challenge');
    if (!this.state.afterAnswers.length) {
      await this.introCard({
        eyebrow: 'Final Garden',
        title: 'One Last Challenge',
        text: 'Before your Empathy Pyramid grows, make a few last quick choices. Again, choose what you would most likely do in real life.',
        button: 'Begin'
      });
    }
    await this.askQuestions(this.data.questions.after, 'after', 'One Last Challenge');
    this.showResults();
  }

  async showResults(revisit = false) {
    const s = this.state;
    this.busy = true;
    $('#pins').hidden = true;
    this.world.interactive = false;
    if (!revisit) {
      s.stage = 'results';
      if (!s.completedAt) s.completedAt = new Date().toISOString();
      this.save();
    }
    HUD.show(false);
    this.stageEl.innerHTML = '';

    const journey = calc([...s.missionAnswers, ...s.digitalAnswers]);
    const values = this.data.garden.values;
    const layers = VALUES.map(k => ({ key: k, name: values[k].name, color: values[k].color, pct: journey.pct[k] }));
    const root = $('#pyramid-root');

    await transition('fade', async () => {
      this.world.pause();
      root.hidden = false;
      root.innerHTML = `
        <div class="pyr-canvas" id="pyr-canvas"></div>
        <div class="pyr-header"><h2>Your Empathy Values Pyramid</h2><p>Built from your choices in ${esc(s.nickname)}'s journey</p></div>
        <div class="pyr-labels" id="pyr-labels">${layers.map(l => `<button class="pyr-label" data-k="${l.key}" style="color:${l.color}"><span class="nm">${esc(l.name)}</span> — <span class="pct" data-pct>${l.pct === null ? '—' : '0%'}</span></button>`).join('')}</div>
        <div id="pyr-card-slot"></div>
        <div class="pyr-panel paper" id="pyr-journey" hidden></div>
        <div class="pyr-bottom">
          <p class="pyr-hint">Drag to turn · scroll or pinch to zoom · click a layer to learn more</p>
          <div class="pyr-actions">
            <button class="btn btn-ghost btn-sm" id="pyr-journey-btn">Your Journey (Before / After)</button>
            ${s.mode === 'demo' ? '<a class="btn btn-ghost btn-sm" href="research/" target="_blank" rel="noopener">Research result ↗</a>' : ''}
            <button class="btn btn-gold" id="pyr-continue">Continue to the garden ›</button>
          </div>
          <p class="disclaimer">This result is based only on your choices in this interactive activity. It is not a psychological diagnosis or clinical assessment.</p>
        </div>`;
    });

    this.renderJourneyPanel();
    $('#pyr-journey-btn').addEventListener('click', () => {
      const p = $('#pyr-journey');
      p.hidden = !p.hidden;
      p.classList.toggle('mobile-open', !p.hidden);
      if (!p.hidden) this.animateBars();
    });

    const labels = {};
    $$('.pyr-label', root).forEach(b => { labels[b.dataset.k] = b; b.addEventListener('click', () => { this.pyramid?.select(b.dataset.k); this.openLayerCard(b.dataset.k, journey); }); });

    const onLabel = positions => {
      for (const p of positions) {
        const el = labels[p.key];
        if (!el) continue;
        el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - 16)}px)`;
      }
    };

    const skip = $('#skip-anim');
    try {
      const mod = await import('./pyramid.js');
      this.pyramid = await mod.createPyramid($('#pyr-canvas'), {
        layers,
        onSelect: key => this.openLayerCard(key, journey),
        onLabel
      });
      if (revisit) {
        this.pyramid.finishInstant();
        layers.forEach(l => { labels[l.key].classList.add('show'); labels[l.key].querySelector('[data-pct]').textContent = l.pct === null ? '—' : l.pct + '%'; });
      } else {
        skip.hidden = false;
        skip.onclick = () => { motion.skipping = true; finishAll(); };
        Sound.setMode('quiet');
        await this.pyramid.build(key => {
          const el = labels[key];
          el.classList.add('show');
          const l = layers.find(x => x.key === key);
          Sound.chime();
          if (l.pct !== null) countUp(el.querySelector('[data-pct]'), l.pct);
        });
        motion.skipping = false;
        skip.hidden = true;
        layers.forEach(l => { labels[l.key].classList.add('show'); if (l.pct !== null) labels[l.key].querySelector('[data-pct]').textContent = l.pct + '%'; });
        this.unlock('garden_keeper');
        if (window.innerWidth > 1100) { $('#pyr-journey').hidden = false; this.animateBars(); }
      }
    } catch (err) {
      console.warn('3D pyramid unavailable, using 2D pyramid', err);
      skip.hidden = true;
      $('#pyr-canvas').innerHTML = `<div class="pyr-fallback"><div class="css-pyramid">${layers.slice().reverse().map((l, i) => `<button data-k="${l.key}" style="background:${l.color};width:${120 + (4 - i) * 70}px">${esc(l.name)} — ${l.pct === null ? '—' : l.pct + '%'}</button>`).join('')}</div></div>`;
      $$('.css-pyramid button').forEach(b => b.addEventListener('click', () => this.openLayerCard(b.dataset.k, journey)));
      $('#pyr-labels').hidden = true;
      this.unlock('garden_keeper');
    }

    $('#pyr-continue').addEventListener('click', async () => {
      await transition('light', async () => {
        this.pyramid?.dispose();
        this.pyramid = null;
        root.hidden = true;
        root.innerHTML = '';
        this.world.resume();
        if (s.stage !== 'final') { s.stage = 'final'; this.save(); }
      });
      this.showFinal();
    });
  }

  openLayerCard(key, journey) {
    const v = this.data.garden.values[key];
    const s = this.state;
    const pct = journey.pct[key];
    const best = strongestDecision([...s.missionAnswers, ...s.digitalAnswers], key);
    const slot = $('#pyr-card-slot');
    $$('.pyr-label').forEach(l => l.classList.toggle('active', l.dataset.k === key));
    slot.innerHTML = `<div class="pyr-card paper" role="dialog" aria-label="Your ${esc(v.name)}">
      <button class="modal-close" aria-label="Close">×</button>
      <span class="eyebrow-dark">Plant: ${esc(v.plant)}</span>
      <h3>Your ${esc(v.name)}</h3>
      <div class="big-pct" style="color:${v.color}">${pct === null ? '—' : pct + '%'}</div>
      <h5>What it means</h5><p>${esc(v.description)}</p>
      <h5>Your strongest decision</h5><p>${best ? `“${esc(best.text)}”` : 'None of your choices in this journey gave points to this value yet.'}</p>
      <h5>Growth suggestion</h5><p>${esc(v.growth)}</p>
    </div>`;
    slot.querySelector('.modal-close').addEventListener('click', () => { slot.innerHTML = ''; $$('.pyr-label').forEach(l => l.classList.remove('active')); });
    Sound.click();
  }

  renderJourneyPanel() {
    const s = this.state;
    const values = this.data.garden.values;
    let before, after, note = '';
    if (s.mode === 'demo') {
      before = DEMO_SAMPLE.before; after = DEMO_SAMPLE.after;
      note = '<p class="hint">Demo Mode: these Before/After numbers are <b>sample data</b>, not real results.</p>';
    } else {
      before = calc(s.beforeAnswers).pct;
      after = calc(s.afterAnswers).pct;
    }
    const diff = improvement(before, after);
    const panel = $('#pyr-journey');
    panel.innerHTML = `<h3>Your Journey</h3>${note}
      <div class="bar-legend"><span><i class="b"></i>Before</span><span><i></i>After</span></div>
      ${VALUES.map(k => `<div class="bar-row">
        <div class="bar-head"><span>${esc(values[k].name)}</span>
          <span class="diff ${diff[k] > 0 ? 'up' : diff[k] < 0 ? 'down' : ''}">${before[k] ?? '—'}% → ${after[k] ?? '—'}% ${diff[k] === null ? '' : `(${diff[k] > 0 ? '+' : ''}${diff[k]})`}</span></div>
        <div class="bar-track"><div class="bar-fill before" style="background:${values[k].color}" data-w="${before[k] || 0}"></div></div>
        <div class="bar-track"><div class="bar-fill" style="background:${values[k].color}" data-w="${after[k] || 0}"></div></div>
      </div>`).join('')}
      <p class="hint" style="margin-top:8px">Change = After − Before (percentage points).</p>`;
  }

  animateBars() {
    const panel = $('#pyr-journey');
    $$('.bar-fill', panel).forEach(b => { b.style.width = '0'; });
    setTimeout(() => $$('.bar-fill', panel).forEach(b => { b.style.width = b.dataset.w + '%'; }), 80);
  }

  /* ================= Final Garden ================= */
  async showFinal() {
    const s = this.state;
    this.world.setMode('final');
    this.world.setGardenStage(5, false);
    Sound.setMode('garden');
    HUD.show(false);
    $('#pins').hidden = true;
    this.world.interactive = false;
    this.world.cameraTo(this.world.is3D ? { pos: { x: 0, y: 4.4, z: 16 }, look: { x: 0, y: 1.2, z: 4.5 } } : null, 3);
    const date = new Date(s.completedAt || Date.now()).toLocaleDateString();
    const badgeName = s.mode === 'demo' ? 'Empathy Explorer' : 'Garden Keeper';
    this.stageEl.innerHTML = `
      <div class="final-text"><h2>You restored the Secret Garden.</h2><p>But the most important journey happened in your choices.</p></div>
      <div class="badge-wrap"><div class="badge-card paper">
        ${medalSVG(s.avatar, badgeName)}
        <div>
          <span class="eyebrow-dark">${esc(badgeName)} Badge</span>
          <h3>${esc(s.nickname)}</h3>
          <p>Journey complete · ${esc(date)}</p>
          <p>${this.missionList().length}/${this.missionList().length} missions · ${s.seedsEarned} Empathy Seeds</p>
          <div class="card-actions" style="justify-content:flex-start;margin-top:10px">
            <button class="btn btn-primary btn-sm" id="fin-explore">Explore the garden</button>
            <button class="btn btn-soft btn-sm" id="fin-pyr">My pyramid</button>
            <button class="btn btn-soft btn-sm" id="fin-save">Save badge</button>
            ${s.mode === 'demo' ? '<a class="btn btn-soft btn-sm" href="research/" target="_blank" rel="noopener">Research dashboard ↗</a>' : ''}
          </div>
        </div>
      </div></div>`;
    $('#fin-explore').addEventListener('click', async () => {
      this.stageEl.innerHTML = '';
      await this.world.toOverview(2);
      this.enterHub();
      HUD.setMission('The Secret Garden', 'Restored Garden');
    });
    $('#fin-pyr').addEventListener('click', () => this.showResults(true));
    $('#fin-save').addEventListener('click', () => this.downloadBadge(badgeName));
  }

  async downloadBadge(badgeName) {
    const s = this.state;
    const c = document.createElement('canvas');
    c.width = 900; c.height = 520;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 900, 520);
    grd.addColorStop(0, '#fbf6ea'); grd.addColorStop(1, '#e6d8bd');
    g.fillStyle = grd; g.fillRect(0, 0, 900, 520);
    g.strokeStyle = '#c2a058'; g.lineWidth = 6; g.strokeRect(18, 18, 864, 484);
    g.strokeStyle = 'rgba(194,160,88,.5)'; g.lineWidth = 2; g.strokeRect(32, 32, 836, 456);
    const svg = medalSVG(s.avatar, badgeName).replace('<svg ', '<svg width="300" height="300" ');
    const img = new Image();
    await new Promise(res => { img.onload = res; img.onerror = res; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    try { g.drawImage(img, 60, 110, 300, 300); } catch { /* image could not be drawn */ }
    g.fillStyle = '#7a5a40'; g.font = '800 22px Nunito, sans-serif';
    g.fillText(`${badgeName.toUpperCase()} BADGE`, 400, 150);
    g.fillStyle = '#1f3326'; g.font = '700 64px "Cormorant Garamond", Georgia, serif';
    g.fillText(s.nickname, 400, 225);
    g.font = '600 26px Nunito, sans-serif'; g.fillStyle = '#2b2a22';
    g.fillText('The Secret Garden: My Empathy Journey', 400, 280);
    g.fillText(`Journey complete · ${new Date(s.completedAt || Date.now()).toLocaleDateString()}`, 400, 320);
    g.fillText(`${s.seedsEarned} Empathy Seeds grown`, 400, 360);
    g.font = 'italic 600 24px "Cormorant Garamond", Georgia, serif'; g.fillStyle = '#5a5546';
    g.fillText('“Every choice reveals something about us.”', 400, 420);
    c.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `secret-garden-badge-${s.nickname.replace(/\s+/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }

  /* ================= HUD buttons & panels ================= */
  bindHUD() {
    $('#btn-sound').addEventListener('click', () => {
      Sound.init();
      this.settings.sound = !this.settings.sound;
      this.applySettings();
      toast(this.settings.sound ? '🔊 Sound on' : '🔇 Sound off', 1500);
    });
    $('#btn-settings').addEventListener('click', () => this.showSettings());
    $('#btn-help').addEventListener('click', () => this.showHelp());
    $('#btn-journal').addEventListener('click', () => this.showJournal());
  }

  bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (closeTopModal()) e.preventDefault(); return; }
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || hasModal()) return;
      const n = '123456'.indexOf(e.key);
      if (n >= 0) {
        const group = [...this.stageEl.querySelectorAll('.choices:not(.locked)')].find(g => !g.hidden);
        const btn = group?.querySelectorAll('.choice')[n];
        if (btn) { e.preventDefault(); btn.click(); }
        return;
      }
      const letter = 'abcd'.indexOf(e.key.toLowerCase());
      if (letter >= 0 && !e.metaKey && !e.ctrlKey) {
        const group = this.stageEl.querySelector('.choices:not(.locked)');
        const btn = group?.querySelectorAll('.choice')[letter];
        const isLettered = btn?.querySelector('.key')?.textContent === e.key.toUpperCase();
        if (btn && isLettered) { e.preventDefault(); btn.click(); }
      }
    });
  }

  showSettings() {
    const s = this.settings;
    const row = (key, title, sub) => `<div class="toggle-row"><div><b>${title}</b><small>${sub}</small></div>
      <label class="switch"><input type="checkbox" data-k="${key}" ${s[key] ? 'checked' : ''} aria-label="${title}"><span></span></label></div>`;
    const m = modal({
      title: 'Settings',
      body: `${row('sound', 'Sound', 'Quiet garden sounds and chimes')}
        ${row('music', 'Background music', 'Soft music in the garden')}
        ${row('reduceMotion', 'Reduce animations', 'Shorter, calmer animations')}
        ${row('largeText', 'Larger text', 'Make all text bigger')}
        ${row('captions', 'Sound captions', 'Show subtitles for sounds')}
        <div class="toggle-row"><div><b>3D quality</b><small>Low is faster on phones and older laptops (reloads the page)</small></div>
          <select class="select" id="set-quality" style="width:auto">
            ${['auto', 'low', 'high'].map(q => `<option value="${q}" ${s.quality === q ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}
          </select></div>
        <div class="modal-actions" style="justify-content:space-between">
          <button class="btn btn-soft btn-sm" id="set-about">About the Project</button>
          ${this.state ? '<button class="btn btn-danger btn-sm" id="set-restart">Restart Journey</button>' : ''}
        </div>`
    });
    m.el.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('change', () => {
      s[inp.dataset.k] = inp.checked;
      if (inp.dataset.k === 'sound' || inp.dataset.k === 'music') Sound.init();
      this.applySettings();
    }));
    m.el.querySelector('#set-quality').addEventListener('change', e => {
      s.quality = e.target.value;
      Storage.saveSettings(s);
      location.reload();
    });
    m.el.querySelector('#set-about').addEventListener('click', () => { m.close(); this.showAbout(); });
    m.el.querySelector('#set-restart')?.addEventListener('click', async () => {
      const ok = await confirmDialog('Are you sure? Your current journey will be reset.', { yes: 'Restart Journey', no: 'Cancel', danger: true });
      if (!ok) return;
      Storage.clearState();
      location.reload();
    });
  }

  showHelp() {
    modal({
      title: 'How to play',
      body: `<ul class="help-list">
        <li><b>Explore the map.</b> Glowing places (✨) are ready. Grey places (🔒) open later.</li>
        <li><b>Make choices.</b> Read the story and choose what you think is best. There is no “good person / bad person” score.</li>
        <li><b>Empathy Seeds 🌱</b> grow when your choice shows respect, understanding, kindness, caring or compassion.</li>
        <li><b>Restore the garden.</b> Each mission brings grass, flowers, leaves and birds back.</li>
        <li><b>Plant seeds</b> by the Fountain. <b>Look for hidden things</b> with a soft sparkle.</li>
        <li><b>Keyboard:</b> Tab to move, Enter to choose, keys 1–4 to answer, Esc to close a window.</li>
        <li>Your progress is saved automatically in this browser.</li>
      </ul>`
    });
  }

  showAbout() {
    modal({
      title: 'About the Project',
      wide: true,
      body: `<p class="lead"><b>The Secret Garden: My Empathy Journey</b> is an interactive 3D research platform that connects a classic novel with modern digital life.</p>
        <h4>The book</h4>
        <p><i>The Secret Garden</i> (1911) was written by <b>Frances Hodgson Burnett</b>. Mary Lennox, Colin Craven and Dickon Sowerby bring a locked, forgotten garden back to life — and change themselves along the way.</p>
        <h4>Research purpose</h4>
        <p>To explore how students choose in situations connected to five empathy values — <b>Respect, Understanding, Kindness, Caring and Compassion</b> — first in the story, then in modern digital life.</p>
        <h4>Method</h4>
        <div class="flow"><span>Before choices</span><i>→</i><span>Story missions</span><i>→</i><span>Digital situations</span><i>→</i><span>After choices</span><i>→</i><span>Empathy Pyramid</span></div>
        <p>Each choice gives points to one or more values. For each value: <b>score = obtained points ÷ maximum possible points × 100</b>. Change = After − Before. Answer order is shuffled for every player, and the Before and After situations are different but measure the same values.</p>
        <h4>Privacy</h4>
        <p>No full names, phone numbers, emails or addresses are collected. Only an anonymous ID, a nickname, grade, answers, scores and times are saved. The result is not a psychological diagnosis.</p>`
    });
  }

  showResearchMode() {
    const m = modal({
      title: 'Research Mode',
      wide: true,
      body: `<p class="lead">For teachers and researchers. The platform follows this research logic:</p>
        <div class="flow"><span>Before</span><i>→</i><span>Activities (5 missions + digital)</span><i>→</i><span>After</span><i>→</i><span>Result</span></div>
        <ul class="help-list">
          <li><b>Full Journey</b> (15–25 min): what students play. All anonymous data is saved for the research.</li>
          <li><b>Demo Mode</b> (3–5 min): one story mission (Help Colin), one digital situation, garden restoration and the 3D pyramid. Demo data is marked and not counted in the research.</li>
          <li><b>Research Dashboard</b>: participants, averages, Before/After charts, most selected choices and completion rates. Address: <code>/research</code></li>
        </ul>
        <div class="modal-actions">
          <a class="btn btn-soft" href="research/" target="_blank" rel="noopener">Open Research Dashboard ↗</a>
          <button class="btn btn-gold" id="rm-demo">Start Demo Mode</button>
        </div>`
    });
    m.el.querySelector('#rm-demo').addEventListener('click', () => { m.close(); this.startDemo(); });
  }

  showJournal() {
    const s = this.state;
    if (!s) return;
    const d = this.data;
    const tabs = ['Story', 'Values', 'Seeds', 'Achievements', 'My Journey'];
    const m = modal({ wide: true, className: 'journal', label: 'Garden Journal', body: `
      <div class="journal-head"><span class="eyebrow-dark">${esc(s.nickname || 'Explorer')}'s</span><h2>Garden Journal</h2></div>
      <div class="tabs" role="tablist">${tabs.map((t, i) => `<button class="tab" role="tab" aria-selected="${i === 0}" data-t="${i}">${t}</button>`).join('')}</div>
      <div class="tab-panel" role="tabpanel" id="journal-panel"></div>` });
    const panel = m.el.querySelector('#journal-panel');
    const render = i => {
      m.el.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(Number(t.dataset.t) === i)));
      panel.innerHTML = [this.jStory, this.jValues, this.jSeeds, this.jAchievements, this.jJourney][i].call(this);
      panel.querySelector('[data-plant]')?.addEventListener('click', () => { m.close(); this.onSelect('fountain'); });
    };
    m.el.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => render(Number(t.dataset.t))));
    render(0);
  }

  jStory() {
    const s = this.state, d = this.data;
    const chars = ['mary', 'colin', 'dickon'].map(k => {
      const c = d.characters[k];
      return `<div class="char-card"><div class="portrait">${portrait(k, 'happy')}</div><div><h4>${esc(c.name)}</h4><p>${esc(c.note)}</p>${c.quote ? `<q>${esc(c.quote)}</q>` : ''}</div></div>`;
    }).join('');
    const story = this.missions.map(m => {
      const done = s.completedMissions.includes(m.id);
      return `<div class="list-item ${done ? '' : 'locked'}"><span class="li-ico">${done ? '📖' : '🔒'}</span><div><h5>${done ? esc(m.title) : '???'}</h5><p>${done ? esc(m.summary) : 'Complete this mission to unlock the story.'}</p></div></div>`;
    }).join('');
    const pages = d.garden.collectibles.filter(c => c.id.startsWith('page')).map(c => {
      const has = s.collectibles.includes(c.id);
      return `<div class="list-item ${has ? '' : 'locked'}"><span class="li-ico">${has ? c.icon : '❔'}</span><div><h5>${has ? esc(c.name) : 'Missing page'}</h5><p>${has ? esc(c.text) : 'A book page is hidden somewhere in the garden.'}</p></div></div>`;
    }).join('');
    return `<h3>Characters</h3>${chars}<h3 style="margin-top:18px">Unlocked story</h3>${story}<h3 style="margin-top:18px">Book pages</h3>${pages}`;
  }

  jValues() {
    const s = this.state, v = this.data.garden.values;
    return `<p class="hint">Your seeds grew in these values. Exact percentages appear only at the end of the journey.</p>` + VALUES.map(k => `
      <div class="value-row"><span class="swatch" style="background:${v[k].color}"></span>
        <div><b>${esc(v[k].name)}</b> <small>· ${esc(v[k].plant)}</small><p>${esc(v[k].description)}</p></div>
        <span class="stat-pill">🌱 ${s.seedsByValue[k] || 0}</span></div>`).join('');
  }

  jSeeds() {
    const s = this.state, plants = this.data.garden.plants, values = this.data.garden.values;
    const fountainOk = this.locationState('fountain') !== 'locked';
    return `<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
        <div><div class="seed-big">${s.seeds}</div><p class="hint">seeds to plant</p></div>
        <div><div class="seed-big">${s.seedsEarned}</div><p class="hint">seeds earned</p></div>
        <div><div class="seed-big">${(s.planted || []).length}</div><p class="hint">plants grown</p></div>
      </div>
      <h3 style="margin-top:14px">Your plants</h3>
      ${(s.planted || []).length ? (s.planted.map(p => `<div class="list-item"><span class="li-ico" style="width:46px">${plantSVG(p.type).replace('<svg', '<svg width="40" height="48"')}</span><div><h5>${esc(plants[p.type].name)}</h5><p>${esc(values[plants[p.type].value].name)}</p></div></div>`).join('')) : '<p class="hint">No plants yet.</p>'}
      ${fountainOk && !$('#pins').hidden ? '<div class="modal-actions"><button class="btn btn-primary" data-plant>Plant seeds at the Fountain</button></div>' : ''}`;
  }

  jAchievements() {
    const s = this.state;
    return this.data.garden.achievements.map(a => {
      const has = s.achievements.includes(a.id);
      return `<div class="list-item ${has ? '' : 'locked'}"><span class="li-ico">${has ? a.icon : '🔒'}</span><div><h5>${esc(a.name)}</h5><p>${esc(a.text)}</p></div></div>`;
    }).join('');
  }

  jJourney() {
    const s = this.state, d = this.data;
    const list = this.missionList();
    return `<div class="char-card"><div class="portrait">${avatarSVG(s.avatar)}</div><div><h4>${esc(s.nickname)}</h4>
        <p>Journey ${list.filter(m => s.completedMissions.includes(m.id)).length}/${list.length} · Started ${new Date(s.startedAt).toLocaleDateString()}</p></div></div>
      <h3 style="margin-top:14px">Missions</h3>
      ${list.map((m, i) => `<div class="list-item ${s.completedMissions.includes(m.id) ? '' : 'locked'}"><span class="li-ico">${s.completedMissions.includes(m.id) ? '✅' : '○'}</span><div><h5>Mission ${i + 1}: ${esc(m.title)}</h5><p>${esc(m.values.join(' + '))}</p></div></div>`).join('')}
      <h3 style="margin-top:14px">Collectibles (${s.collectibles.length}/${d.garden.collectibles.length})</h3>
      <p style="font-size:1.6rem;letter-spacing:6px">${d.garden.collectibles.map(c => s.collectibles.includes(c.id) ? `<span title="${esc(c.name)}">${c.icon}</span>` : '<span title="Not found yet" style="opacity:.3">❔</span>').join('')}</p>
      ${s.thenNow.length ? `<h3 style="margin-top:14px">Then &amp; Now</h3>${s.thenNow.map(t => `<div class="list-item"><span class="li-ico">📖</span><div><h5>${esc(t.book)}</h5><p>📱 ${esc(t.today)}</p></div></div>`).join('')}` : ''}`;
  }
}
