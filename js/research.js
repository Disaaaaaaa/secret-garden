/*
  research.js — the researcher dashboard (/research).
  Reads anonymous records from this browser (localStorage) and, if configured,
  from Supabase. Shows averages, Before/After charts, completion and most selected choices.
*/
import { Storage, buildRecord, newParticipantId } from './storage.js';
import { VALUES, VALUE_NAMES, averagePct, makeAnswer, totalPoints } from './scoring.js';

const COLORS = { respect: '#4f7d32', understanding: '#2479a8', kindness: '#b07f12', caring: '#6a5cb8', compassion: '#b8434f' };
const BEFORE = '#b07f12';
const AFTER = '#2479a8';
const INK_MUTED = '#74766b';
const GRID = '#ebe6d9';

const $ = s => document.querySelector(s);
let data = null;
let allRecords = [];
const charts = {};

function toast(msg) {
  const t = $('#r-tooltip');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

async function loadData() {
  const get = p => fetch(p).then(r => r.json());
  const [questions, missions] = await Promise.all([get('../data/questions.json'), get('../data/missions.json')]);
  return { questions, missions };
}

/* ---------- load & filter ---------- */
async function loadRecords() {
  const local = Storage.getRecords();
  let remote = null;
  if (Storage.supabaseEnabled()) {
    try { remote = await Storage.fetchRemoteRecords(); }
    catch (e) { toast('Could not reach Supabase — showing this device only.'); }
  }
  const map = new Map();
  for (const r of [...(remote || []), ...local]) {
    const old = map.get(r.participantId);
    if (!old || (r.updatedAt || '') > (old.updatedAt || '')) map.set(r.participantId, r);
  }
  $('#source').textContent = remote ? `Supabase + this device · ${map.size} records` : `This device only · ${map.size} records`;
  return [...map.values()];
}

function filtered() {
  const sample = $('#f-sample').checked;
  const demo = $('#f-demo').checked;
  const grade = $('#f-grade').value;
  return allRecords.filter(r => (sample || !r.sample) && (demo || r.mode !== 'demo') && (!grade || String(r.grade) === grade));
}

/* ---------- statistics ---------- */
const mean = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const fmt = v => (v === null || v === undefined || Number.isNaN(v) ? '—' : Math.round(v));

function stats(records) {
  const nQ = data.questions.before.length;
  const total = records.length;
  const missionIds = data.missions.missions.map(m => m.id);
  const completed = records.filter(r => r.completedAt && (r.afterAnswers?.length >= nQ || r.mode === 'demo'));
  const withBefore = records.filter(r => r.beforeAnswers?.length >= nQ);
  const withBoth = records.filter(r => r.beforeAnswers?.length >= nQ && r.afterAnswers?.length >= nQ);

  const beforeAvg = {}, afterAvg = {}, journeyAvg = {};
  for (const v of VALUES) {
    beforeAvg[v] = mean(withBoth.map(r => r.beforeScores?.[v]).filter(x => typeof x === 'number'));
    afterAvg[v] = mean(withBoth.map(r => r.afterScores?.[v]).filter(x => typeof x === 'number'));
    journeyAvg[v] = mean(records.map(r => r[v + 'Score']).filter(x => typeof x === 'number'));
  }
  const avgBefore = mean(withBefore.map(r => averagePct(r.beforeScores)).filter(x => x !== null));
  const avgAfter = mean(withBoth.map(r => averagePct(r.afterScores)).filter(x => x !== null));
  const improvement = mean(withBoth.map(r => averagePct(r.afterScores) - averagePct(r.beforeScores)));
  const completion = missionIds.map(id => ({ id, rate: total ? records.filter(r => r.completedMissions?.includes(id)).length / total * 100 : 0 }));
  return { total, completed: completed.length, withBoth: withBoth.length, beforeAvg, afterAvg, journeyAvg, avgBefore, avgAfter, improvement, completion };
}

/* ---------- render ---------- */
function tile(label, value, sub = '') {
  return `<div class="r-tile"><div class="lbl">${label}</div><div class="val">${value}</div><div class="sub">${sub}</div></div>`;
}

function renderTiles(s) {
  const imp = s.improvement === null ? '—' : `${s.improvement > 0 ? '+' : ''}${Math.round(s.improvement)}`;
  $('#tiles').innerHTML = [
    tile('Total participants', s.total, 'started the journey'),
    tile('Completed', s.completed, s.total ? `${Math.round(s.completed / s.total * 100)}% of participants` : ''),
    tile('Average Before', s.avgBefore === null ? '—' : fmt(s.avgBefore) + '%', 'mean of the 5 values'),
    tile('Average After', s.avgAfter === null ? '—' : fmt(s.avgAfter) + '%', `${s.withBoth} with Before + After`),
    tile('Average change', imp, 'percentage points (After − Before)'),
    ...VALUES.map(v => tile(`${VALUE_NAMES[v]} (journey)`, s.journeyAvg[v] === null ? '—' : fmt(s.journeyAvg[v]) + '%', 'average'))
  ].join('');
}

function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f3326',
        titleColor: '#e2c98b',
        bodyColor: '#f7f0e1',
        padding: 10,
        callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y ?? c.parsed.r ?? c.parsed}${c.dataset.unit || '%'}` }
      }
    },
    ...extra
  };
}

function axes(max = 100) {
  return {
    x: { grid: { display: false }, ticks: { color: INK_MUTED, font: { family: 'Nunito', weight: 700 } }, border: { color: GRID } },
    y: { min: 0, max, grid: { color: GRID }, ticks: { color: INK_MUTED, callback: v => v + '%' }, border: { display: false } }
  };
}

function drawChart(id, config) {
  if (!window.Chart) return;
  charts[id]?.destroy();
  charts[id] = new window.Chart(document.getElementById(id), config);
}

function bar(label, values, color, extra = {}) {
  return {
    label,
    data: values,
    backgroundColor: color,
    hoverBackgroundColor: color,
    borderColor: '#fcfcfb',
    borderWidth: 2,
    borderRadius: { topLeft: 4, topRight: 4 },
    borderSkipped: 'start',
    maxBarThickness: 34,
    ...extra
  };
}

function renderCharts(s) {
  const labels = VALUES.map(v => VALUE_NAMES[v]);
  const r = v => (v === null ? null : Math.round(v));
  drawChart('c-beforeafter', {
    type: 'bar',
    data: { labels, datasets: [bar('Before', VALUES.map(v => r(s.beforeAvg[v])), BEFORE), bar('After', VALUES.map(v => r(s.afterAvg[v])), AFTER)] },
    options: baseOptions({ scales: axes(), plugins: { ...baseOptions().plugins, tooltip: { ...baseOptions().plugins.tooltip, mode: 'index', intersect: false } } })
  });
  drawChart('c-radar', {
    type: 'radar',
    data: {
      labels,
      datasets: [
        { label: 'Before', data: VALUES.map(v => r(s.beforeAvg[v])), borderColor: BEFORE, backgroundColor: 'rgba(176,127,18,.12)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: BEFORE },
        { label: 'After', data: VALUES.map(v => r(s.afterAvg[v])), borderColor: AFTER, backgroundColor: 'rgba(36,121,168,.12)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: AFTER }
      ]
    },
    options: baseOptions({
      scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, color: INK_MUTED, backdropColor: 'transparent', callback: v => v + '%' }, grid: { color: GRID }, angleLines: { color: GRID }, pointLabels: { color: '#4d5045', font: { family: 'Nunito', weight: 800, size: 12 } } } },
      plugins: { ...baseOptions().plugins, tooltip: { ...baseOptions().plugins.tooltip, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.r}%` } } }
    })
  });
  drawChart('c-values', {
    type: 'bar',
    data: { labels, datasets: [bar('Journey average', VALUES.map(v => r(s.journeyAvg[v])), VALUES.map(v => COLORS[v]))] },
    options: baseOptions({ scales: axes() })
  });
  const titles = Object.fromEntries(data.missions.missions.map(m => [m.id, `${m.order}. ${m.title}`]));
  drawChart('c-completion', {
    type: 'bar',
    data: { labels: s.completion.map(c => titles[c.id]), datasets: [bar('Completed', s.completion.map(c => Math.round(c.rate)), '#1f3326')] },
    options: baseOptions({ scales: axes() })
  });
}

function renderValueTable(s) {
  const row = v => `<tr><td><span class="swatch" style="background:${COLORS[v]}"></span>${VALUE_NAMES[v]}</td>
    <td class="num">${fmt(s.beforeAvg[v])}%</td><td class="num">${fmt(s.afterAvg[v])}%</td>
    <td class="num">${s.beforeAvg[v] === null || s.afterAvg[v] === null ? '—' : (s.afterAvg[v] - s.beforeAvg[v] > 0 ? '+' : '') + Math.round(s.afterAvg[v] - s.beforeAvg[v])}</td>
    <td class="num">${fmt(s.journeyAvg[v])}%</td></tr>`;
  $('#t-values').innerHTML = `<thead><tr><th>Value</th><th class="num">Before</th><th class="num">After</th><th class="num">Change (pp)</th><th class="num">Journey</th></tr></thead>
    <tbody>${VALUES.map(row).join('')}</tbody>
    <tfoot><tr><td colspan="5">Mission completion: ${s.completion.map(c => `${c.id.toUpperCase()} ${Math.round(c.rate)}%`).join(' · ')}</td></tr></tfoot>`;
}

function questionIndex() {
  const idx = {};
  data.questions.before.forEach(q => { idx[q.id] = { group: 'Before', text: q.text }; });
  data.questions.after.forEach(q => { idx[q.id] = { group: 'After', text: q.text }; });
  for (const m of data.missions.missions) {
    for (const st of m.steps) {
      if (st.type === 'decision') idx[st.id] = { group: `Mission ${m.order}`, text: st.prompt };
      if (st.type === 'chat') idx[st.id] = { group: 'Digital', text: st.prompt };
      if (st.type === 'minigame' && st.game === 'emotionMatch') st.rounds.forEach((r, i) => { idx[`${m.id}_emo${i + 1}`] = { group: `Mission ${m.order}`, text: `Emotion Match: “${r.phrase}”` }; });
    }
  }
  return idx;
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderChoices(records) {
  const idx = questionIndex();
  const counts = {};
  for (const r of records) {
    for (const a of [...(r.beforeAnswers || []), ...(r.missionAnswers || []), ...(r.digitalAnswers || []), ...(r.afterAnswers || [])]) {
      const c = counts[a.qid] = counts[a.qid] || { n: 0, opts: {} };
      c.n++;
      const o = c.opts[a.optionId] = c.opts[a.optionId] || { n: 0, text: a.text, pts: totalPoints(a.scores) };
      o.n++;
    }
  }
  const order = Object.keys(idx);
  const rows = order.filter(q => counts[q]).map(q => {
    const c = counts[q];
    const top = Object.values(c.opts).sort((a, b) => b.n - a.n)[0];
    return `<tr><td><span class="tag">${esc(idx[q].group)}</span></td><td>${esc(idx[q].text)}</td><td>${esc(top.text)}</td>
      <td class="num">${Math.round(top.n / c.n * 100)}%</td><td class="num">${c.n}</td></tr>`;
  });
  $('#t-choices').innerHTML = `<thead><tr><th>Part</th><th>Question</th><th>Most selected answer</th><th class="num">Share</th><th class="num">Answers</th></tr></thead>
    <tbody>${rows.join('') || '<tr><td colspan="5">No answers yet.</td></tr>'}</tbody>`;
}

function renderPeople(records) {
  const rows = records.slice().sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')).map(r => `<tr>
    <td>${esc(r.participantId)}</td><td>${esc(r.nickname)}</td><td>${esc(r.grade)}</td>
    <td>${r.sample ? '<span class="tag">sample</span>' : `<span class="tag">${esc(r.mode)}</span>`}</td>
    <td class="num">${(r.completedMissions || []).length}</td>
    <td class="num">${fmt(averagePct(r.beforeScores))}%</td><td class="num">${fmt(averagePct(r.afterScores))}%</td>
    <td>${r.completedAt ? '<span class="tag done">completed</span>' : '<span class="tag">in progress</span>'}</td>
    <td>${r.startedAt ? new Date(r.startedAt).toLocaleString() : ''}</td></tr>`);
  $('#t-people').innerHTML = `<thead><tr><th>Anonymous ID</th><th>Nickname</th><th>Grade</th><th>Type</th><th class="num">Missions</th><th class="num">Before</th><th class="num">After</th><th>Status</th><th>Started</th></tr></thead>
    <tbody>${rows.join('') || '<tr><td colspan="9">No participants yet.</td></tr>'}</tbody>`;
}

function render() {
  const records = filtered();
  $('#empty').hidden = records.length > 0;
  const grades = [...new Set(allRecords.map(r => String(r.grade || '')).filter(Boolean))].sort();
  const sel = $('#f-grade');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All grades</option>' + grades.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  sel.value = cur;
  const s = stats(records);
  renderTiles(s);
  renderCharts(s);
  renderValueTable(s);
  renderChoices(records);
  renderPeople(records);
}

/* ---------- sample data (clearly marked, for previewing the dashboard) ---------- */
function pickWeighted(options, bias) {
  const w = options.map(o => 1 + totalPoints(o.scores) * bias);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) { r -= w[i]; if (r <= 0) return options[i]; }
  return options[options.length - 1];
}

function makeSample() {
  const bias = 0.4 + Math.random() * 0.8;
  const st = {
    participantId: newParticipantId('S'), nickname: 'Sample' + Math.floor(10 + Math.random() * 90), grade: String(7 + Math.floor(Math.random() * 3)),
    avatar: 1 + Math.floor(Math.random() * 3), mode: 'full', sample: true,
    beforeAnswers: [], missionAnswers: [], digitalAnswers: [], afterAnswers: [], completedMissions: [], seedsEarned: 0,
    startedAt: new Date(Date.now() - Math.random() * 7 * 864e5).toISOString()
  };
  data.questions.before.forEach(q => st.beforeAnswers.push(makeAnswer(q, pickWeighted(q.options, bias))));
  const finish = Math.random() < 0.8;
  const missions = data.missions.missions;
  const howMany = finish ? missions.length : Math.floor(Math.random() * missions.length);
  for (const m of missions.slice(0, howMany)) {
    let i = 0;
    while (i < m.steps.length) {
      const step = m.steps[i];
      let next = step.next;
      if (step.type === 'decision' || step.type === 'chat') {
        const opt = pickWeighted(step.options, bias * 1.6);
        (m.digital ? st.digitalAnswers : st.missionAnswers).push(makeAnswer(step, opt, { mission: m.id }));
        next = opt.next || next;
      }
      if (step.type === 'minigame' && step.game === 'emotionMatch') {
        step.rounds.forEach((rd, k) => {
          const ok = Math.random() < 0.75;
          st.missionAnswers.push({ qid: `${m.id}_emo${k + 1}`, optionId: ok ? rd.answer[0] : 'happy', text: `Emotion: ${ok ? rd.answer[0] : 'happy'}`, scores: { respect: 0, understanding: ok ? 1 : 0, kindness: 0, caring: 0, compassion: 0 }, max: { respect: 0, understanding: 1, kindness: 0, caring: 0, compassion: 0 }, mission: m.id });
        });
      }
      const j = next ? m.steps.findIndex(s => s.id === next) : -1;
      i = j >= 0 ? j : i + 1;
    }
    st.completedMissions.push(m.id);
  }
  if (finish) {
    data.questions.after.forEach(q => st.afterAnswers.push(makeAnswer(q, pickWeighted(q.options, bias * 1.5))));
    st.completedAt = new Date(new Date(st.startedAt).getTime() + (15 + Math.random() * 10) * 60000).toISOString();
  }
  return buildRecord(st);
}

/* ---------- export / import ---------- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function toCSV(records) {
  const head = ['participantId', 'nickname', 'grade', 'mode', 'sample', 'startedAt', 'completedAt', 'missionsCompleted',
    ...VALUES.map(v => 'before_' + v), ...VALUES.map(v => 'after_' + v), ...VALUES.map(v => 'journey_' + v), 'before_avg', 'after_avg', 'change'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = records.map(r => {
    const b = averagePct(r.beforeScores), a = averagePct(r.afterScores);
    return [r.participantId, r.nickname, r.grade, r.mode, r.sample ? 1 : 0, r.startedAt, r.completedAt, (r.completedMissions || []).length,
      ...VALUES.map(v => r.beforeScores?.[v]), ...VALUES.map(v => r.afterScores?.[v]), ...VALUES.map(v => r[v + 'Score']),
      b, a, b !== null && a !== null ? a - b : ''].map(q).join(',');
  });
  return '﻿' + [head.join(','), ...lines].join('\n');
}

/* ---------- start ---------- */
async function start() {
  data = await loadData();
  allRecords = await loadRecords();
  render();

  ['#f-sample', '#f-demo', '#f-grade'].forEach(s => $(s).addEventListener('change', render));
  $('#refresh').addEventListener('click', async () => { allRecords = await loadRecords(); render(); toast('Updated'); });
  $('#add-sample').addEventListener('click', () => {
    const list = Storage.getRecords();
    for (let i = 0; i < 24; i++) list.push(makeSample());
    Storage.setRecords(list);
    allRecords = Storage.getRecords();
    $('#f-sample').checked = true;
    loadRecords().then(r => { allRecords = r; render(); });
    toast('24 sample participants added (marked as sample).');
  });
  $('#remove-sample').addEventListener('click', () => {
    Storage.setRecords(Storage.getRecords().filter(r => !r.sample));
    loadRecords().then(r => { allRecords = r; render(); });
    toast('Sample data removed.');
  });
  $('#clear-local').addEventListener('click', () => {
    if (!confirm('Delete ALL research records saved in this browser? Export them first if you need them.')) return;
    Storage.clearRecords();
    loadRecords().then(r => { allRecords = r; render(); });
  });
  $('#export-json').addEventListener('click', () => download(`secret-garden-research-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(filtered(), null, 2), 'application/json'));
  $('#export-csv').addEventListener('click', () => download(`secret-garden-research-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(filtered()), 'text/csv'));
  $('#import-json').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const incoming = JSON.parse(await file.text());
      if (!Array.isArray(incoming)) throw new Error('not a list');
      const list = Storage.getRecords();
      let added = 0;
      for (const r of incoming) {
        if (!r || typeof r.participantId !== 'string') continue;
        const i = list.findIndex(x => x.participantId === r.participantId);
        if (i < 0) { list.push(r); added++; } else if ((r.updatedAt || '') > (list[i].updatedAt || '')) list[i] = r;
      }
      Storage.setRecords(list);
      allRecords = await loadRecords();
      render();
      toast(`Imported ${added} new participants.`);
    } catch {
      toast('This file is not a Secret Garden research export.');
    }
    e.target.value = '';
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
