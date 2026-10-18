/*
  minigames.js — Find the Key, Emotion Match, Restore the Path and Seed Planting.
*/
import { $, esc, toast } from './ui.js';
import { portrait, plantSVG } from './portraits.js';
import { Sound } from './audio.js';
import { shuffle, emptyVector } from './scoring.js';
import { wait, seedFloat } from './animations.js';

const EMO_ICONS = { lonely: '😔', worried: '😟', hopeful: '🌱', angry: '😠', happy: '😊', excluded: '🚪', sad: '😢', scared: '😨' };

function stageScreen(game, markup, cls = '') {
  const stage = game.stageEl;
  stage.innerHTML = `<div class="screen-center ${cls}">${markup}</div>`;
  return stage.firstElementChild;
}

/* ---------- Find the Key ---------- */
export async function findKey(game, step) {
  const world = game.world;
  if (world.is3D) {
    game.stageEl.innerHTML = `<div class="find-key-hud paper" role="status">
      <span class="eyebrow-dark">Mini-game · Find the Key</span>
      <p id="fk-msg">${esc(step.text)}</p>
      <p class="hint">Click the glowing places near the Old Tree.</p>
    </div>`;
    await world.focus('oldTree', 1.2);
    await world.startFindKey(msg => {
      const el = $('#fk-msg');
      if (el) el.textContent = msg;
      Sound.click();
    });
  } else {
    // 2D version
    const spots = shuffle([
      { id: 'pot', icon: '🪴', name: 'Flowerpot', msg: 'Just an old flowerpot.' },
      { id: 'stone', icon: '🪨', name: 'Stone', msg: 'Nothing under this stone.' },
      { id: 'leaves', icon: '🍂', name: 'Leaves', msg: 'Only dry leaves.' },
      { id: 'hollow', icon: '🌳', name: 'Tree hollow', msg: 'An empty hollow.' },
      { id: 'soil', icon: '🐦', name: "Robin's soil", key: true }
    ]);
    const box = stageScreen(game, `<div class="card paper">
      <span class="eyebrow-dark">Mini-game · Find the Key</span>
      <p>${esc(step.text)}</p>
      <p id="fk-msg" class="hint" role="status">Where could it be?</p>
      <div class="search-grid">${spots.map(s => `<button class="search-spot" data-id="${s.id}">${s.icon}<small>${esc(s.name)}</small></button>`).join('')}</div>
    </div>`, 'dim');
    await new Promise(resolve => {
      box.querySelectorAll('.search-spot').forEach(b => b.addEventListener('click', () => {
        const s = spots.find(x => x.id === b.dataset.id);
        if (s.key) { b.textContent = '🗝️'; resolve(); return; }
        b.disabled = true;
        $('#fk-msg').textContent = s.msg;
      }));
    });
  }
  Sound.chime();
  game.collect('key', { silent: false });
  toast('You found the old key! 🗝️');
  await wait(600);
}

/* ---------- Emotion Match ---------- */
export async function emotionMatch(game, step, missionId) {
  const rounds = step.rounds;
  const options = step.emotions;
  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r];
    const box = stageScreen(game, `<div class="card paper">
      <div class="quiz-head">
        <span class="eyebrow-dark">Mini-game · Emotion Match</span>
        <span class="round-dots">${rounds.map((_, i) => `<i class="${i < r ? 'done' : ''}"></i>`).join('')}</span>
      </div>
      <p class="lead">${esc(step.text)}</p>
      <div class="emo-stage">
        <div class="portrait emo-face">${portrait(round.speaker, round.emotion)}</div>
        <div>
          <p class="emo-posture">${esc(round.posture)}</p>
          <p class="emo-phrase">“${esc(round.phrase)}”</p>
        </div>
      </div>
      <div class="emo-grid" role="group" aria-label="Choose an emotion">
        ${shuffle(options).map((e, i) => `<button class="emo-btn" data-e="${e}"><span aria-hidden="true">${EMO_ICONS[e] || ''}</span>${esc(e)}</button>`).join('')}
      </div>
      <p class="hint" id="emo-msg" role="status">&nbsp;</p>
    </div>`, 'dim');
    game.world.setMood?.('colin', round.emotion === 'sad' ? 'sad' : round.emotion);

    await new Promise(resolve => {
      let tries = 0;
      const firstPick = [];
      box.querySelectorAll('.emo-btn').forEach(btn => btn.addEventListener('click', async () => {
        const e = btn.dataset.e;
        firstPick.push(e);
        tries++;
        const right = round.answer.includes(e);
        const msg = $('#emo-msg');
        if (right) {
          btn.classList.add('right');
          box.querySelectorAll('.emo-btn').forEach(b => { b.disabled = true; });
          const firstTry = tries === 1;
          const scores = emptyVector();
          if (firstTry) scores.understanding = 1;
          const max = emptyVector();
          max.understanding = 1;
          game.recordAnswer('mission', {
            qid: `${missionId}_emo${r + 1}`, optionId: firstPick[0], text: `Emotion: ${firstPick[0]}`,
            scores, max, t: new Date().toISOString(), tries
          });
          msg.textContent = `Yes — Colin feels ${round.answer.join(' and ')}. Noticing feelings is the first step to understanding.`;
          if (firstTry) {
            const rect = btn.getBoundingClientRect();
            game.addSeeds(1, 'understanding', rect.left + rect.width / 2, rect.top);
            Sound.seed();
          } else {
            Sound.chime();
          }
          await wait(1700);
          resolve();
        } else {
          btn.classList.add('wrong');
          btn.disabled = true;
          Sound.thoughtful();
          if (tries >= 2) {
            msg.textContent = `Look again at his face and his words. Colin feels ${round.answer.join(' / ')}.`;
            box.querySelectorAll('.emo-btn').forEach(b => { if (round.answer.includes(b.dataset.e)) b.classList.add('right'); });
            box.querySelectorAll('.emo-btn').forEach(b => { b.disabled = true; });
            const max = emptyVector(); max.understanding = 1;
            game.recordAnswer('mission', {
              qid: `${missionId}_emo${r + 1}`, optionId: firstPick[0], text: `Emotion: ${firstPick[0]}`,
              scores: emptyVector(), max, t: new Date().toISOString(), tries
            });
            await wait(2400);
            resolve();
          } else {
            msg.textContent = 'Hmm, look again at his face, how he moves and what he says.';
          }
        }
      }));
    });
  }
}

/* ---------- Restore the Path (drag and drop) ---------- */
export async function restorePath(game, step) {
  const order = step.stones;
  const names = game.data.garden.values;
  const box = stageScreen(game, `<div class="card card-wide paper">
    <span class="eyebrow-dark">Mini-game · Restore the Path</span>
    <p class="lead">${esc(step.text)}</p>
    <div class="path-board">
      <div class="path-slots" aria-label="Path">
        ${order.map((v, i) => `<div class="path-slot" data-i="${i}" tabindex="0" role="button" aria-label="Place ${i + 1}: ${esc(step.hints[i])}">
          <span class="slot-num">${i + 1}</span><span class="slot-hint">${esc(step.hints[i])}</span></div>`).join('')}
      </div>
      <div class="path-pile" aria-label="Value stones">
        ${shuffle(order).map(v => `<button class="stone" data-v="${v}">${esc(names[v].name)}</button>`).join('')}
      </div>
    </div>
    <p class="hint" id="path-msg" role="status">Drag a stone onto the path — or click a stone, then click a place.</p>
    <div class="card-actions"><button class="btn btn-primary" id="path-done" hidden>Continue</button></div>
  </div>`, 'dim');

  const msg = $('#path-msg');
  let selected = null;
  let placed = 0;

  const tryPlace = (stone, slot) => {
    const i = Number(slot.dataset.i);
    if (slot.classList.contains('filled')) return false;
    if (order[i] !== stone.dataset.v) {
      stone.classList.remove('bad'); void stone.offsetWidth; stone.classList.add('bad');
      msg.textContent = `Not quite. Place ${i + 1} is: “${step.hints[i]}”.`;
      Sound.thoughtful();
      return false;
    }
    slot.classList.add('filled');
    slot.innerHTML = '';
    stone.classList.remove('selected');
    stone.classList.add('placed');
    stone.disabled = true;
    slot.appendChild(stone);
    placed++;
    Sound.seed();
    msg.textContent = `${names[stone.dataset.v].name} is in place.`;
    if (placed === order.length) {
      msg.textContent = 'The path is restored! Now Colin\'s chair can reach the garden.';
      Sound.grow();
      game.world.celebrate?.('hiddenBench');
      const done = $('#path-done');
      done.hidden = false;
      done.focus();
    }
    return true;
  };

  box.querySelectorAll('.stone').forEach(stone => {
    stone.addEventListener('click', () => {
      if (stone.classList.contains('placed')) return;
      box.querySelectorAll('.stone').forEach(s => s.classList.remove('selected'));
      selected = stone;
      stone.classList.add('selected');
      msg.textContent = `Now click a place on the path for “${names[stone.dataset.v].name}”.`;
    });
    // pointer drag
    stone.addEventListener('pointerdown', e => {
      if (stone.classList.contains('placed') || e.button > 0) return;
      const start = { x: e.clientX, y: e.clientY };
      let ghost = null;
      const move = ev => {
        if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
          ghost = stone.cloneNode(true);
          ghost.classList.add('dragging');
          ghost.style.width = stone.offsetWidth + 'px';
          document.body.appendChild(ghost);
          stone.style.opacity = 0.35;
        }
        if (ghost) {
          ghost.style.left = ev.clientX - ghost.offsetWidth / 2 + 'px';
          ghost.style.top = ev.clientY - 24 + 'px';
          box.querySelectorAll('.path-slot').forEach(s => {
            const r = s.getBoundingClientRect();
            s.classList.toggle('over', ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom);
          });
        }
      };
      const up = ev => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!ghost) return;
        ghost.remove();
        stone.style.opacity = '';
        const slot = [...box.querySelectorAll('.path-slot')].find(s => s.classList.contains('over'));
        box.querySelectorAll('.path-slot').forEach(s => s.classList.remove('over'));
        if (slot) tryPlace(stone, slot);
        stone.dataset.dragged = '1';
        setTimeout(() => delete stone.dataset.dragged, 50);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  });
  box.querySelectorAll('.path-slot').forEach(slot => {
    const act = () => { if (selected && !selected.classList.contains('placed')) { if (tryPlace(selected, slot)) selected = null; } else msg.textContent = 'First choose a stone.'; };
    slot.addEventListener('click', act);
    slot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });
  await new Promise(resolve => $('#path-done').addEventListener('click', resolve, { once: true }));
}

/* ---------- Seed Planting ---------- */
export function planting(game) {
  return new Promise(resolve => {
    const plants = game.data.garden.plants;
    const values = game.data.garden.values;
    const COST = 2;
    const state = game.state;
    let type = 'rose';
    let selectedPlot = null;
    let phase = 'seed'; // seed → water

    const render = () => {
      const planted = state.planted || [];
      game.stageEl.innerHTML = `<div class="screen-center dim"><div class="card card-wide paper">
        <button class="modal-close" id="pl-close" aria-label="Close">×</button>
        <span class="eyebrow-dark">Mini-game · Seed Planting</span>
        <h2>The Fountain Beds</h2>
        <p class="lead">Plant your Empathy Seeds. Each plant stands for a value. One plant needs ${COST} seeds. You have <b>${state.seeds}</b> seeds.</p>
        <div class="plant-layout">
          <div>
            <div class="plots">${[0, 1, 2, 3, 4, 5].map(i => {
              const p = planted.find(x => x.plot === i);
              return `<button class="plot ${p ? 'grown' : ''} ${selectedPlot === i ? 'selected' : ''}" data-plot="${i}" aria-label="${p ? plants[p.type].name + ' (' + values[plants[p.type].value].name + ')' : 'Empty plot ' + (i + 1)}">
                ${p ? `<span class="plot-label">${esc(plants[p.type].name)}</span>${plantSVG(p.type)}` : ''}
              </button>`;
            }).join('')}</div>
            <p class="hint" id="pl-msg" role="status">1. Choose a plant · 2. Drag the seed packet onto an empty plot · 3. Water it.</p>
          </div>
          <div class="plant-side">
            ${Object.entries(plants).map(([k, p]) => `<button class="plant-type" data-type="${k}" aria-pressed="${k === type}">
              <span class="dot" style="background:${values[p.value].color}"></span>
              <span>${esc(p.name)}<small>${esc(values[p.value].name)}</small></span></button>`).join('')}
            <div class="seed-packet" id="seed-packet" role="button" tabindex="0" aria-label="Seed packet: plant a ${esc(plants[type].name)} in the selected plot">🌰 ${esc(plants[type].name)} seeds</div>
            <button class="btn btn-soft btn-sm watering-can" id="water-btn" hidden>💧 Water the seed</button>
          </div>
        </div>
      </div></div>`;
      bind();
    };

    const msg = t => { const el = $('#pl-msg'); if (el) el.textContent = t; };

    const plantSeed = plotIdx => {
      if (phase !== 'seed') return;
      if ((state.planted || []).some(p => p.plot === plotIdx)) { msg('This plot already has a plant.'); return; }
      if (state.seeds < COST) { msg(`You need ${COST} seeds. Complete missions to earn more Empathy Seeds.`); Sound.thoughtful(); return; }
      selectedPlot = plotIdx;
      const plot = game.stageEl.querySelector(`[data-plot="${plotIdx}"]`);
      game.stageEl.querySelectorAll('.plot').forEach(p => p.classList.remove('selected'));
      plot.classList.add('selected', 'has-seed');
      phase = 'water';
      Sound.seed();
      msg('The seed is in the soil. Now water it!');
      const w = $('#water-btn');
      w.hidden = false;
      w.focus();
    };

    const water = async () => {
      if (phase !== 'water' || selectedPlot === null) return;
      const plotIdx = selectedPlot;
      const plot = game.stageEl.querySelector(`[data-plot="${plotIdx}"]`);
      Sound.water();
      plot.classList.add('watered');
      for (let i = 0; i < 10; i++) {
        const d = document.createElement('span');
        d.className = 'water-drop';
        d.style.left = 25 + Math.random() * 50 + '%';
        d.style.top = Math.random() * 20 + '%';
        d.style.animationDelay = Math.random() * 0.4 + 's';
        plot.appendChild(d);
      }
      await wait(800);
      plot.classList.remove('has-seed');
      plot.insertAdjacentHTML('beforeend', `<span class="plot-label">${esc(plants[type].name)}</span>${plantSVG(type)}`);
      plot.querySelector('svg').classList.add('grow');
      state.seeds -= COST;
      state.planted = [...(state.planted || []), { plot: plotIdx, type, t: new Date().toISOString() }];
      game.hudSeeds(true);
      game.world.addPlant?.(plotIdx, type, true);
      Sound.grow();
      game.save();
      game.unlock('green_thumb');
      msg(`A ${plants[type].name} grew! It stands for ${values[plants[type].value].name}.`);
      phase = 'seed';
      selectedPlot = null;
      await wait(1600);
      render();
    };

    const bind = () => {
      $('#pl-close').addEventListener('click', () => { game.stageEl.innerHTML = ''; resolve(); });
      game.stageEl.querySelectorAll('.plant-type').forEach(b => b.addEventListener('click', () => { type = b.dataset.type; if (phase === 'seed') render(); }));
      game.stageEl.querySelectorAll('.plot').forEach(p => p.addEventListener('click', () => {
        const idx = Number(p.dataset.plot);
        if (phase === 'water') { msg('Water the seed first.'); return; }
        if ((state.planted || []).some(x => x.plot === idx)) return;
        game.stageEl.querySelectorAll('.plot').forEach(x => x.classList.remove('selected'));
        p.classList.add('selected');
        selectedPlot = idx;
        msg('Plot chosen. Now drag the seed packet here — or press the seed packet.');
      }));
      $('#water-btn').addEventListener('click', water);
      const packet = $('#seed-packet');
      const usePacket = () => { if (selectedPlot !== null) plantSeed(selectedPlot); else msg('First choose an empty plot (or drag the seed packet onto one).'); };
      packet.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); usePacket(); } });
      packet.addEventListener('pointerdown', e => {
        const start = { x: e.clientX, y: e.clientY };
        let ghost = null;
        const move = ev => {
          if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
            ghost = packet.cloneNode(true);
            ghost.classList.add('dragging');
            document.body.appendChild(ghost);
          }
          if (ghost) {
            ghost.style.left = ev.clientX - 60 + 'px';
            ghost.style.top = ev.clientY - 20 + 'px';
            game.stageEl.querySelectorAll('.plot').forEach(s => {
              const r = s.getBoundingClientRect();
              s.classList.toggle('over', ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom);
            });
          }
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (!ghost) { usePacket(); return; }
          ghost.remove();
          const over = [...game.stageEl.querySelectorAll('.plot')].find(s => s.classList.contains('over'));
          game.stageEl.querySelectorAll('.plot').forEach(s => s.classList.remove('over'));
          if (over) plantSeed(Number(over.dataset.plot));
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    };
    render();
  });
}

export { seedFloat };
