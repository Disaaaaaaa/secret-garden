/*
  scoring.js — the five Empathy Values and how results are calculated.

  Every answer can give points to one or more values.
  For each value:   score % = obtained points / maximum possible points × 100
  Improvement:      After % − Before %   (percentage points)
*/

export const VALUES = ['respect', 'understanding', 'kindness', 'caring', 'compassion'];

export const VALUE_NAMES = {
  respect: 'Respect',
  understanding: 'Understanding',
  kindness: 'Kindness',
  caring: 'Caring',
  compassion: 'Compassion'
};

export function emptyVector() {
  return { respect: 0, understanding: 0, kindness: 0, caring: 0, compassion: 0 };
}

/** Clean a scores object so it only has the five values (missing → 0). */
export function normalizeScores(scores = {}) {
  const v = emptyVector();
  for (const key of VALUES) v[key] = Number(scores[key]) || 0;
  return v;
}

/** The best possible points for each value in one question (max over its options). */
export function maxVector(options) {
  const m = emptyVector();
  for (const o of options) {
    for (const key of VALUES) m[key] = Math.max(m[key], Number(o.scores?.[key]) || 0);
  }
  return m;
}

/** Build one answer record (saved for the research data). */
export function makeAnswer(question, option, extra = {}) {
  return {
    qid: question.id,
    optionId: option.id,
    text: option.text,
    scores: normalizeScores(option.scores),
    max: maxVector(question.options),
    t: new Date().toISOString(),
    ...extra
  };
}

/** Total points of one answer (used for seeds and feedback). */
export function totalPoints(scores) {
  return VALUES.reduce((sum, key) => sum + (Number(scores?.[key]) || 0), 0);
}

/**
 * Calculate obtained points, maximum points and percentage for each value.
 * pct[value] is null when no question in the list could give points to that value.
 */
export function calc(answers = []) {
  const obtained = emptyVector();
  const max = emptyVector();
  for (const a of answers) {
    for (const key of VALUES) {
      obtained[key] += a.scores?.[key] || 0;
      max[key] += a.max?.[key] || 0;
    }
  }
  const pct = {};
  for (const key of VALUES) {
    pct[key] = max[key] > 0 ? Math.round((obtained[key] / max[key]) * 100) : null;
  }
  return { obtained, max, pct };
}

/** Average of the five percentages (only for research summaries). */
export function averagePct(pct) {
  const list = VALUES.map(k => pct?.[k]).filter(v => typeof v === 'number');
  if (!list.length) return null;
  return Math.round(list.reduce((a, b) => a + b, 0) / list.length);
}

/** After − Before for every value. */
export function improvement(beforePct, afterPct) {
  const diff = {};
  for (const key of VALUES) {
    const b = beforePct?.[key];
    const a = afterPct?.[key];
    diff[key] = typeof a === 'number' && typeof b === 'number' ? a - b : null;
  }
  return diff;
}

/** Empathy Seeds for a choice: more thoughtful choices grow more seeds. */
export function seedsFor(scores) {
  const pts = totalPoints(scores);
  if (pts >= 4) return 3;
  if (pts >= 2) return 2;
  if (pts >= 1) return 1;
  return 0;
}

/** The value with the most points in one answer (or null). */
export function topValue(scores) {
  let best = null;
  let bestPts = 0;
  for (const key of VALUES) {
    if ((scores?.[key] || 0) > bestPts) { best = key; bestPts = scores[key]; }
  }
  return best;
}

/** The answer that gave the most points to one value. */
export function strongestDecision(answers, value) {
  let best = null;
  for (const a of answers) {
    const pts = a.scores?.[value] || 0;
    if (pts > 0 && (!best || pts > best.scores[value])) best = a;
  }
  return best;
}

/** Fisher–Yates shuffle (used to randomize answer order). */
export function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
