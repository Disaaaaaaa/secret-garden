/*
  audio.js — quiet garden sounds made with the Web Audio API.
  No sound files are needed: wind, birds, soft music and chimes are
  generated in the browser. The game works fully without sound.
*/

const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

class GardenAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = true;
    this.mode = 'garden';
    this.onCaption = null;
    this._timers = [];
    this._lastCaption = {};
  }

  /** Must be called after a click (browsers block sound before that). */
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0.5;
    this.ambGain.connect(this.master);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.55 : 0;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1800;
    this.musicFilter.connect(this.musicGain);
    this.musicGain.connect(this.master);

    this.fxGain = ctx.createGain();
    this.fxGain.gain.value = 0.7;
    this.fxGain.connect(this.master);

    this._noise = this._makeNoise();
    this._startWind();
    this._loop('birds', () => this.mode === 'garden' && this.birdSong(), 2600, 7000);
    this._loop('music', () => this._musicStep(), 5200, 7800);
    this.setEnabled(this.enabled);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on ? 0.55 : 0, now, 0.4);
  }

  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.5);
  }

  /** 'garden' | 'digital' | 'quiet' */
  setMode(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain?.gain.setTargetAtTime(mode === 'garden' ? 0.09 : mode === 'quiet' ? 0.03 : 0.0, t, 0.8);
    this.musicFilter.frequency.setTargetAtTime(mode === 'digital' ? 1200 : 1800, t, 0.5);
    if (mode === 'digital') this.caption('[soft electronic music]');
  }

  caption(text) {
    const now = Date.now();
    if (this._lastCaption[text] && now - this._lastCaption[text] < 20000) return;
    this._lastCaption[text] = now;
    if (this.enabled) this.onCaption?.(text);
  }

  /* ---------- building blocks ---------- */
  _makeNoise() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish noise (soft)
      data[i] = last * 3.5;
    }
    return buf;
  }

  _startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.09;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(this.windGain.gain);
    src.connect(filter).connect(this.windGain).connect(this.ambGain);
    src.start();
    lfo.start();
  }

  _loop(name, fn, minMs, maxMs) {
    const tick = () => {
      if (this.ctx && this.enabled && document.visibilityState === 'visible') fn();
      this._timers[name] = setTimeout(tick, minMs + Math.random() * (maxMs - minMs));
    };
    this._timers[name] = setTimeout(tick, minMs);
  }

  _tone({ freq, type = 'sine', start = 0, dur = 0.5, vol = 0.1, attack = 0.01, dest, glideTo }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest || this.fxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noiseBurst({ start = 0, dur = 0.6, vol = 0.2, from = 300, to = 900, type = 'bandpass' }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.fxGain);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  _musicStep() {
    if (!this.musicOn || this.mode === 'quiet') return;
    if (this.mode === 'digital') {
      // soft electronic ambience: gentle plucked arpeggio
      const base = [PENTA[0], PENTA[2], PENTA[4], PENTA[5], PENTA[3]];
      base.forEach((f, i) => this._tone({ freq: f, type: 'triangle', start: i * 0.32, dur: 0.9, vol: 0.022, dest: this.musicFilter }));
      return;
    }
    // garden: slow, warm chord
    const root = PENTA[Math.floor(Math.random() * 4)];
    [1, 1.25, 1.5].forEach((m, i) => this._tone({ freq: root * m / 2, type: 'sine', start: i * 0.15, dur: 6, vol: 0.02, attack: 2, dest: this.musicFilter }));
  }

  /* ---------- public sound effects ---------- */
  birdSong() {
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1400;
    for (let i = 0; i < n; i++) {
      this._tone({ freq: base, glideTo: base * (1.2 + Math.random() * 0.4), type: 'sine', start: i * 0.13, dur: 0.1, vol: 0.025, dest: this.ambGain });
    }
    this.caption('[birds singing]');
  }

  chime() {
    [880, 1318.5, 1760].forEach((f, i) => this._tone({ freq: f, start: i * 0.09, dur: 1.4, vol: 0.06 }));
    this._tone({ freq: 880 * 2.76, start: 0, dur: 0.8, vol: 0.015 });
    this.caption('[soft chime]');
  }

  seed() {
    this._tone({ freq: 660, start: 0, dur: 0.25, vol: 0.06, type: 'triangle' });
    this._tone({ freq: 990, start: 0.1, dur: 0.35, vol: 0.05, type: 'triangle' });
  }

  /** gentle, non-aggressive sound for a weaker choice */
  thoughtful() {
    this._tone({ freq: 392, start: 0, dur: 0.9, vol: 0.04, attack: 0.08 });
    this._tone({ freq: 329.6, start: 0.25, dur: 1.1, vol: 0.035, attack: 0.08 });
  }

  click() {
    this._tone({ freq: 520, start: 0, dur: 0.08, vol: 0.03, type: 'triangle' });
  }

  keyTurn() {
    this._noiseBurst({ dur: 0.18, vol: 0.25, from: 1800, to: 2500 });
    this._tone({ freq: 140, start: 0.12, dur: 0.25, vol: 0.12, type: 'triangle' });
    this.caption('[key turns in the lock]');
  }

  gate() {
    this._noiseBurst({ dur: 1.6, vol: 0.18, from: 220, to: 700 });
    this._tone({ freq: 90, start: 0.1, dur: 1.2, vol: 0.05, type: 'sawtooth', glideTo: 70 });
    this.caption('[old gate creaks open]');
  }

  whoosh() {
    this._noiseBurst({ dur: 1.0, vol: 0.12, from: 300, to: 2400, type: 'lowpass' });
  }

  pixels() {
    for (let i = 0; i < 6; i++) this._tone({ freq: 600 + i * 140, start: i * 0.06, dur: 0.12, vol: 0.02, type: 'square' });
    this.caption('[digital sparkle]');
  }

  grow() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone({ freq: f, start: i * 0.12, dur: 0.8, vol: 0.04 }));
    this.caption('[the garden grows]');
  }

  achievement() {
    [784, 988, 1175, 1568].forEach((f, i) => this._tone({ freq: f, start: i * 0.08, dur: 1.0, vol: 0.05 }));
    this.caption('[achievement chime]');
  }

  water() {
    for (let i = 0; i < 6; i++) this._tone({ freq: 900 + Math.random() * 700, start: i * 0.09, dur: 0.12, vol: 0.02, glideTo: 500 });
  }
}

export const Sound = new GardenAudio();
