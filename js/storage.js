/*
  storage.js — saving progress and anonymous research data.

  • Progress (current journey) → localStorage "sg_state_v1"
  • Settings (sound, motion…)  → localStorage "sg_settings_v1"
  • Research records           → localStorage "sg_research_v1"
                                  + Supabase (optional, see js/config.js)

  No real names, emails, phone numbers or addresses are ever stored.
*/
import { calc, VALUES } from './scoring.js';

const STATE_KEY = 'sg_state_v1';
const SETTINGS_KEY = 'sg_settings_v1';
const RECORDS_KEY = 'sg_research_v1';
const PENDING_KEY = 'sg_pending_sync_v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try { localStorage.removeItem(key); } catch { /* storage blocked */ }
}

export const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  reduceMotion: false,
  largeText: false,
  captions: false,
  quality: 'auto'
};

/** Random anonymous ID like "P-7K2QX9MA". */
export function newParticipantId(prefix = 'P') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  let id = '';
  for (const b of bytes) id += chars[b % chars.length];
  return `${prefix}-${id}`;
}

/** The research record (data structure from the technical brief, section 51). */
export function buildRecord(state) {
  const journey = calc([...(state.missionAnswers || []), ...(state.digitalAnswers || [])]);
  const before = calc(state.beforeAnswers || []);
  const after = calc(state.afterAnswers || []);
  return {
    participantId: state.participantId,
    nickname: state.nickname,
    grade: state.grade,
    avatar: state.avatar,
    mode: state.mode,
    sample: !!state.sample,
    beforeAnswers: state.beforeAnswers || [],
    missionAnswers: state.missionAnswers || [],
    digitalAnswers: state.digitalAnswers || [],
    afterAnswers: state.afterAnswers || [],
    respectScore: journey.pct.respect,
    understandingScore: journey.pct.understanding,
    kindnessScore: journey.pct.kindness,
    caringScore: journey.pct.caring,
    compassionScore: journey.pct.compassion,
    beforeScores: before.pct,
    afterScores: after.pct,
    completedMissions: state.completedMissions || [],
    seeds: state.seedsEarned || 0,
    startedAt: state.startedAt,
    completedAt: state.completedAt || null,
    updatedAt: new Date().toISOString(),
    version: 1
  };
}

/* ---------- Supabase (optional) ---------- */
function sbConfig() {
  const c = window.SG_CONFIG || {};
  if (!c.supabaseUrl || !c.supabaseAnonKey) return null;
  return { url: c.supabaseUrl.replace(/\/$/, ''), key: c.supabaseAnonKey, table: c.supabaseTable || 'participants' };
}

async function sbUpsert(records) {
  const c = sbConfig();
  if (!c || !records.length) return true;
  const rows = records.map(r => ({
    participant_id: r.participantId,
    mode: r.mode,
    data: r,
    updated_at: r.updatedAt
  }));
  const res = await fetch(`${c.url}/rest/v1/${c.table}?on_conflict=participant_id`, {
    method: 'POST',
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  return res.ok;
}

let syncTimer = null;

export const Storage = {
  /* Progress */
  loadState() { return read(STATE_KEY, null); },
  saveState(state) { return write(STATE_KEY, state); },
  clearState() { remove(STATE_KEY); },

  /* Settings */
  loadSettings() { return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) }; },
  saveSettings(s) { write(SETTINGS_KEY, s); },

  /* Research records */
  getRecords() { return read(RECORDS_KEY, []); },
  setRecords(list) { write(RECORDS_KEY, list); },
  clearRecords() { remove(RECORDS_KEY); remove(PENDING_KEY); },

  upsertRecord(record) {
    const list = this.getRecords();
    const i = list.findIndex(r => r.participantId === record.participantId);
    if (i >= 0) list[i] = record; else list.push(record);
    this.setRecords(list);
    if (sbConfig() && record.mode !== 'demo') {
      const pending = new Set(read(PENDING_KEY, []));
      pending.add(record.participantId);
      write(PENDING_KEY, [...pending]);
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => this.syncPending(), 1500);
    }
  },

  /** Send waiting records to Supabase (called again when the internet returns). */
  async syncPending() {
    if (!sbConfig() || !navigator.onLine) return false;
    const pending = read(PENDING_KEY, []);
    if (!pending.length) return true;
    const records = this.getRecords().filter(r => pending.includes(r.participantId));
    try {
      const ok = await sbUpsert(records);
      if (ok) write(PENDING_KEY, []);
      return ok;
    } catch {
      return false;
    }
  },

  supabaseEnabled() { return !!sbConfig(); },

  /** Researcher dashboard: read every participant from Supabase. */
  async fetchRemoteRecords() {
    const c = sbConfig();
    if (!c) return null;
    const res = await fetch(`${c.url}/rest/v1/${c.table}?select=data&order=updated_at.desc&limit=5000`, {
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}` }
    });
    if (!res.ok) throw new Error(`Supabase error ${res.status}`);
    const rows = await res.json();
    return rows.map(r => r.data).filter(Boolean);
  }
};

export { VALUES };
