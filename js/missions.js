/*
  missions.js — runs a mission step by step.
  Every mission follows the same structure:
    Explore → Story → Decision → Consequence → Reflection → Reward
*/
import { $, esc, confirmDialog } from './ui.js';
import { portrait } from './portraits.js';
import { shuffle, makeAnswer, seedsFor, topValue } from './scoring.js';
import { Sound } from './audio.js';
import { wait, motion } from './animations.js';
import * as Mini from './minigames.js';

const PHASES = ['Explore', 'Story', 'Decision', 'Consequence', 'Reflection', 'Reward'];
const CHARS_3D = { mary: 'mary', colin: 'colin', dickon: 'dickon' };

export async function runMission(game, mission, { demo = false } = {}) {
  let steps = mission.steps;
  if (demo && mission.digital) steps = steps.filter(s => s.type !== 'chat' || s.demo);
  const ctx = { game, mission, steps, demo, phase: 0, seeds: 0, aborted: false, kind: mission.digital ? 'digital' : 'mission' };
  ctx.abort = new Promise(resolve => { ctx.doAbort = () => { ctx.aborted = true; resolve(); }; });
  ctx.chatTotal = steps.filter(s => s.type === 'chat').length;
  ctx.chatIndex = 0;
  game.clearMissionAnswers(mission.id, steps);

  let i = 0;
  while (i < steps.length) {
    const step = steps[i];
    const jump = await Promise.race([runStep(ctx, step), ctx.abort]);
    if (ctx.aborted) { game.stageEl.innerHTML = ''; return false; }
    const nextId = jump || step.next;
    if (nextId) {
      const j = steps.findIndex(s => s.id === nextId);
      i = j >= 0 ? j : i + 1;
    } else {
      i++;
    }
  }
  await rewardScreen(ctx);
  return true;
}

async function runStep(ctx, step) {
  switch (step.type) {
    case 'explore': return explore(ctx, step);
    case 'narration': return narration(ctx, step);
    case 'dialog': return dialog(ctx, step);
    case 'decision': return decision(ctx, step);
    case 'thenNow': return thenNow(ctx, step);
    case 'chat': return chat(ctx, step);
    case 'minigame':
      setPhase(ctx, 1);
      if (step.game === 'findKey') await Mini.findKey(ctx.game, step);
      else if (step.game === 'emotionMatch') await Mini.emotionMatch(ctx.game, step, ctx.mission.id);
      else if (step.game === 'restorePath') await Mini.restorePath(ctx.game, step);
      if (ctx.game.world.is3D && step.game === 'findKey') await ctx.game.world.focus(ctx.mission.location, 1.2);
      return null;
    default: return null;
  }
}

function setPhase(ctx, index) { ctx.phase = Math.max(index, ctx.phase === 5 ? 5 : index); ctx.current = index; }

function stepper(ctx, current) {
  return `<div class="phase-stepper" aria-label="Mission steps">
    ${PHASES.map((p, i) => `<span class="phase ${i === current ? 'current' : i < current ? 'done' : ''}" ${i === current ? 'aria-current="step"' : ''}>${p}</span>`).join('')}
    <button class="phase leave" data-leave title="Leave this mission" style="cursor:pointer;margin-left:6px">✕ Leave</button>
  </div>`;
}

/** Story panel at the bottom of the screen. */
function panel(ctx, { phase, speaker, emotion, body, actions = '' }) {
  ctx.current = phase;
  const ch = speaker ? ctx.game.data.characters[speaker] : null;
  const hasPortrait = !!speaker;
  ctx.game.stageEl.innerHTML = `<div class="story-wrap">
    ${stepper(ctx, phase)}
    <section class="story-panel paper ${hasPortrait ? 'has-portrait' : 'no-portrait'}">
      ${hasPortrait ? `<div class="portrait" id="sp-portrait">${portrait(speaker, emotion)}</div>` : ''}
      <div class="story-content">
        ${ch ? `<div class="speaker" id="sp-name">${esc(ch.name)}<small>${esc(ch.role || '')}</small></div>` : ''}
        ${body}
        <div class="story-actions">${actions}</div>
      </div>
    </section>
  </div>`;
  const el = ctx.game.stageEl.firstElementChild;
  el.querySelector('[data-leave]').addEventListener('click', async () => {
    if (await confirmDialog('Leave this mission? You can start it again from the map.', { yes: 'Leave mission', no: 'Stay' })) ctx.doAbort();
  });
  return el;
}

function continueButton(label = 'Continue') {
  return `<span class="kbd-hint">Press Enter ↵</span><button class="btn btn-primary" data-continue>${esc(label)} ›</button>`;
}

function waitContinue(el) {
  const btn = el.querySelector('[data-continue]');
  setTimeout(() => btn?.focus(), 60);
  return new Promise(resolve => btn.addEventListener('click', () => { Sound.click(); resolve(); }, { once: true }));
}

function mood3D(ctx, speaker, emotion) {
  const name = CHARS_3D[speaker];
  if (name) ctx.game.world.setMood?.(name, emotion === 'neutral' ? 'idle' : emotion, 5);
}

/* ---------- steps ---------- */
async function explore(ctx, step) {
  if (step.focus) ctx.game.world.focus(step.focus, 1.8);
  const el = panel(ctx, {
    phase: 0,
    body: `<p class="story-text narration">${esc(step.text)}</p>`,
    actions: continueButton('Explore')
  });
  await waitContinue(el);
  return null;
}

async function narration(ctx, step) {
  const el = panel(ctx, {
    phase: 1,
    speaker: 'narrator',
    body: `<p class="story-text narration">${esc(step.text)}</p>`,
    actions: continueButton()
  });
  await waitContinue(el);
  return null;
}

async function dialog(ctx, step) {
  mood3D(ctx, step.speaker, step.emotion);
  const el = panel(ctx, {
    phase: 1,
    speaker: step.speaker,
    emotion: step.emotion,
    body: `<p class="story-text speech">${esc(step.text)}</p>`,
    actions: continueButton()
  });
  await waitContinue(el);
  return null;
}

async function thenNow(ctx, step) {
  ctx.game.stageEl.innerHTML = `<div class="screen-center dim"><div class="card card-wide paper" role="region" aria-label="Then and Now">
    <span class="eyebrow-dark">Then &amp; Now</span>
    <h2>The story and today</h2>
    <div class="then-now">
      <div class="tn-side tn-book"><h4><span aria-hidden="true">📖</span> The Secret Garden</h4><p>${esc(step.book)}</p></div>
      <div class="tn-arrow" aria-hidden="true">⟶</div>
      <div class="tn-side tn-today"><h4><span aria-hidden="true">📱</span> Today</h4><p>${esc(step.today)}</p></div>
    </div>
    <p class="hint" style="margin-top:12px">The same feelings can happen in a book from 1911 and in a school today.</p>
    <div class="card-actions">${continueButton()}</div>
  </div></div>`;
  ctx.game.journalNote?.('thenNow', step);
  await waitContinue(ctx.game.stageEl);
  return null;
}

async function decision(ctx, step) {
  const { game, mission } = ctx;
  mood3D(ctx, step.speaker, step.emotion);
  const opts = shuffle(step.options);
  const el = panel(ctx, {
    phase: 2,
    speaker: step.speaker,
    emotion: step.emotion,
    body: `<p class="prompt">${esc(step.prompt)}</p>
      <div class="choices" role="group" aria-label="Choose an answer">
        ${opts.map((o, i) => `<button class="choice" data-id="${o.id}"><span class="key">${i + 1}</span><span>${esc(o.text)}</span></button>`).join('')}
      </div>`
  });
  setTimeout(() => el.querySelector('.choice')?.focus(), 80);
  const picked = await new Promise(res => el.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => res(b), { once: true })));
  const option = step.options.find(o => o.id === picked.dataset.id);
  const answer = makeAnswer(step, option, { mission: mission.id, order: opts.map(o => o.id) });
  game.recordAnswer(ctx.kind, answer);

  await consequence(ctx, el, picked, option, step);
  if (step.reflection) await reflection(ctx, step, answer);
  return option.next || null;
}

async function consequence(ctx, el, picked, option, step) {
  const { game, mission } = ctx;
  const seeds = seedsFor(option.scores);
  const good = seeds > 0;
  const choices = el.querySelector('.choices');
  choices.classList.add('locked');
  choices.querySelectorAll('.choice').forEach(b => b.classList.add(b === picked ? 'picked' : 'dimmed'));
  // stepper → Consequence
  el.querySelectorAll('.phase').forEach((p, i) => {
    if (i >= PHASES.length) return;
    p.classList.toggle('current', i === 3);
    p.classList.toggle('done', i < 3);
  });

  const r = option.reaction;
  if (r) {
    const ch = game.data.characters[r.speaker];
    const port = el.querySelector('#sp-portrait');
    if (port) { port.innerHTML = portrait(r.speaker, r.emotion); port.classList.add('react'); }
    const nm = el.querySelector('#sp-name');
    if (nm && ch) nm.innerHTML = `${esc(ch.name)}<small>${esc(ch.role || '')}</small>`;
    mood3D(ctx, r.speaker, r.emotion);
    choices.insertAdjacentHTML('afterend', `<div class="reaction"><b>${esc(ch?.name || '')}:</b> “${esc(r.text)}”</div>`);
  }
  const value = topValue(option.scores);
  const fb = option.feedback || (good ? `This choice showed ${game.data.garden.values[value]?.name.toLowerCase()}.` : 'Think about how they might feel in this situation.');
  const after = el.querySelector('.reaction') || choices;
  after.insertAdjacentHTML('afterend', `<div class="feedback ${good ? 'good' : 'think'}" role="status">
    <span class="fb-ico" aria-hidden="true">${good ? '🌸' : '💭'}</span>
    <div><p>${esc(fb)}</p>${good ? `<span class="seed-gain">+${seeds} Empathy Seed${seeds > 1 ? 's' : ''} 🌱</span>` : ''}</div>
  </div>`);
  if (good) {
    Sound.chime();
    game.world.celebrate?.(mission.location === 'digitalPortal' ? null : mission.location);
    const rect = picked.getBoundingClientRect();
    game.addSeeds(seeds, value, rect.left + rect.width / 2, rect.top);
    ctx.seeds += seeds;
  } else {
    Sound.thoughtful();
  }
  el.querySelector('.story-actions').innerHTML = continueButton();
  el.querySelector('.story-content').scrollIntoView?.({ block: 'nearest' });
  await waitContinue(el);
}

async function reflection(ctx, step, answer) {
  const reasons = ctx.game.data.missions.reflectionReasons;
  const withText = step.reflection === 'text';
  const el = panel(ctx, {
    phase: 4,
    speaker: 'narrator',
    body: `<p class="story-text narration">Why did you choose this?</p>
      <p class="hint">You chose: “${esc(answer.text)}”. There is no wrong answer here.</p>
      <div class="chips" role="group" aria-label="Reasons">
        ${reasons.map(r => `<button class="chip" aria-pressed="false" data-r="${esc(r)}">${esc(r)}</button>`).join('')}
      </div>
      ${withText ? `<div class="field"><label for="refl-text">In your own words (optional)</label>
        <textarea id="refl-text" class="textarea" maxlength="200" placeholder="1–2 sentences. Please don't write real names."></textarea></div>` : ''}`,
    actions: `<button class="btn btn-soft" data-skip>Skip</button><button class="btn btn-primary" data-continue>Save ›</button>`
  });
  let reason = null;
  el.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    el.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', 'false'));
    c.setAttribute('aria-pressed', 'true');
    reason = c.dataset.r;
  }));
  const saved = await new Promise(res => {
    el.querySelector('[data-skip]').addEventListener('click', () => res(false), { once: true });
    el.querySelector('[data-continue]').addEventListener('click', () => res(true), { once: true });
  });
  if (saved) {
    const text = withText ? (el.querySelector('#refl-text').value || '').trim().slice(0, 200) : '';
    if (reason || text) {
      answer.reflection = { reason, text };
      ctx.game.save();
    }
  }
}

/* ---------- Digital chat situations ---------- */
async function chat(ctx, step) {
  const { game } = ctx;
  ctx.chatIndex++;
  const opts = shuffle(step.options);
  game.stageEl.innerHTML = `<div class="screen-center"><div class="digital-layout">
    <div class="phone" aria-label="Phone screen">
      <div class="phone-screen">
        <div class="phone-top"><span class="ava" aria-hidden="true">${esc(step.title.slice(0, 1))}</span>
          <span><b>${esc(step.title)}</b><small>${esc(step.members)}</small></span><span class="app">${esc(step.app)}</span></div>
        <div class="chat" id="chat" aria-live="polite"></div>
      </div>
    </div>
    <div class="digital-side paper">
      ${stepper(ctx, 1).replace('phase-stepper', 'phase-stepper dark-stepper')}
      <span class="scenario-count">Digital situation ${ctx.chatIndex} of ${ctx.chatTotal}</span>
      <p class="prompt" id="chat-prompt" style="margin-top:6px">Read the messages…</p>
      <div class="choices" id="chat-choices" hidden role="group" aria-label="What would you do?">
        ${opts.map((o, i) => `<button class="choice" data-id="${o.id}"><span class="key">${i + 1}</span><span>${esc(o.text)}</span></button>`).join('')}
      </div>
      <div id="chat-after"></div>
      <div class="story-actions" id="chat-actions"></div>
    </div>
  </div></div>`;
  const side = game.stageEl.querySelector('.digital-side');
  side.querySelectorAll('.phase').forEach(p => { p.style.background = 'rgba(31,51,38,.12)'; p.style.color = 'var(--forest)'; });
  side.querySelector('.phase.current').style.background = 'var(--gold-light)';
  side.querySelector('[data-leave]').addEventListener('click', async () => {
    if (await confirmDialog('Leave this mission? You can start it again from the map.', { yes: 'Leave mission', no: 'Stay' })) ctx.doAbort();
  });
  const chatEl = $('#chat');
  await showMessages(chatEl, step.messages);
  $('#chat-prompt').textContent = step.prompt;
  const choices = $('#chat-choices');
  choices.hidden = false;
  setPhaseMarks(side, 2);
  setTimeout(() => choices.querySelector('.choice')?.focus(), 60);
  const picked = await new Promise(res => choices.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => res(b), { once: true })));
  const option = step.options.find(o => o.id === picked.dataset.id);
  const answer = makeAnswer(step, option, { mission: ctx.mission.id, order: opts.map(o => o.id) });
  game.recordAnswer('digital', answer);
  choices.classList.add('locked');
  choices.querySelectorAll('.choice').forEach(b => b.classList.add(b === picked ? 'picked' : 'dimmed'));
  setPhaseMarks(side, 3);
  await showMessages(chatEl, option.result || []);
  const seeds = seedsFor(option.scores);
  const good = seeds > 0;
  const value = topValue(option.scores);
  $('#chat-after').innerHTML = `<div class="feedback ${good ? 'good' : 'think'}" role="status">
      <span class="fb-ico" aria-hidden="true">${good ? '🌸' : '💭'}</span>
      <div><p>${esc(option.feedback)}</p>${good ? `<span class="seed-gain">+${seeds} Empathy Seed${seeds > 1 ? 's' : ''} 🌱</span>` : ''}</div>
    </div>${step.note ? `<p class="safety-note">ℹ️ ${esc(step.note)}</p>` : ''}`;
  if (good) {
    Sound.chime();
    const rect = picked.getBoundingClientRect();
    game.addSeeds(seeds, value, rect.left + rect.width / 2, rect.top);
    ctx.seeds += seeds;
  } else {
    Sound.thoughtful();
  }
  $('#chat-actions').innerHTML = continueButton(ctx.chatIndex < ctx.chatTotal ? 'Next situation' : 'Continue');
  await waitContinue(game.stageEl);
  return null;
}

function setPhaseMarks(root, current) {
  root.querySelectorAll('.phase').forEach((p, i) => {
    if (p.hasAttribute('data-leave')) return;
    p.classList.toggle('current', i === current);
    p.classList.toggle('done', i < current);
    p.style.background = i === current ? 'var(--gold-light)' : 'rgba(31,51,38,.12)';
  });
}

async function showMessages(chatEl, messages) {
  for (const m of messages) {
    if (!m.system && !motion.reduced) {
      const typing = document.createElement('div');
      typing.className = 'typing';
      typing.innerHTML = '<i></i><i></i><i></i>';
      if (m.from === 'me') typing.style.alignSelf = 'flex-end';
      chatEl.appendChild(typing);
      chatEl.scrollTop = chatEl.scrollHeight;
      await wait(650);
      typing.remove();
    }
    const div = document.createElement('div');
    if (m.system) {
      div.className = 'msg system';
      div.textContent = m.system;
    } else {
      div.className = 'msg' + (m.from === 'me' ? ' me' : '') + (m.private ? ' private' : '');
      div.innerHTML = `<b>${esc(m.from === 'me' ? 'You' : m.from)}${m.private ? ' · private' : ''}</b>${esc(m.text)}`;
    }
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    Sound.click();
    await wait(m.system ? 450 : 250);
  }
}

/* ---------- Reward ---------- */
async function rewardScreen(ctx) {
  const { game, mission } = ctx;
  const done = game.missionList().filter(m => game.state.completedMissions.includes(m.id) || m.id === mission.id).length;
  game.stageEl.innerHTML = `<div class="screen-center dim"><div class="card paper reward-card">
    ${stepper(ctx, 5).replace('<button class="phase leave" data-leave title="Leave this mission" style="cursor:pointer;margin-left:6px">✕ Leave</button>', '')}
    <div class="reward-burst" aria-hidden="true">${mission.digital ? '💬' : '🌸'}</div>
    <span class="eyebrow-dark">Mission complete</span>
    <h2>${esc(mission.title)}</h2>
    <p class="lead">${esc(mission.stageText)}</p>
    <div class="reward-stats">
      <span class="stat-pill">🌱 +${ctx.seeds} Empathy Seeds</span>
      <span class="stat-pill">🗺️ Journey ${done}/${game.missionList().length}</span>
    </div>
    <div class="card-actions" style="justify-content:center">${continueButton('Return to the garden')}</div>
  </div></div>`;
  game.stageEl.querySelectorAll('.phase').forEach(p => { p.style.background = p.classList.contains('current') ? 'var(--gold-light)' : 'rgba(31,51,38,.12)'; p.style.color = 'var(--forest)'; });
  Sound.achievement();
  await waitContinue(game.stageEl);
  game.stageEl.innerHTML = '';
}
