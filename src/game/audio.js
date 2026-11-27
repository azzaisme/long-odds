// Original synthesised sound. No samples: everything is oscillators and filtered noise.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  start() {
    if (this.ctx) return this.ctx.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // River and wind bed.
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    this.bed = ctx.createGain();
    this.bed.gain.value = 0.05;
    src.connect(f).connect(this.bed).connect(this.master);
    src.start();
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  tone(freq, dur, type = 'triangle', vol = 0.15, when = 0, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise(dur, freq, vol = 0.2, type = 'lowpass', when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.3, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  step() { this.noise(0.05, 900, 0.035, 'bandpass'); }
  click() { this.tone(660, 0.06, 'square', 0.05); }
  deny() { this.tone(160, 0.14, 'square', 0.06, 0, -40); }
  build() { this.noise(0.12, 300, 0.25); this.tone(110, 0.16, 'triangle', 0.2, 0.02, -40); this.noise(0.1, 500, 0.2, 'lowpass', 0.18); this.tone(130, 0.14, 'triangle', 0.18, 0.2, -40); }
  carry() { [392, 440, 523].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, i * 0.09)); }
  teach() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.11, i * 0.11)); }
  swap() { this.tone(440, 0.07, 'triangle', 0.09); this.tone(587, 0.09, 'triangle', 0.09, 0.07); }
  commit() { [196, 147, 98].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.07, i * 0.16)); }
  flood(level) { this.noise(1.2 + level * 0.6, 240 + level * 60, 0.12 + level * 0.07); }
  erupt() { this.noise(3.5, 120, 0.45); this.tone(55, 2.5, 'sawtooth', 0.14, 0, -20); this.noise(1.5, 900, 0.12, 'bandpass', 0.3); }
  tornado() { this.noise(2.4, 500, 0.22, 'bandpass'); this.tone(90, 2.2, 'sawtooth', 0.05, 0, 60); }
  slide() { this.noise(1.6, 180, 0.35); }
  harvest() { [659, 784, 988].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.07, i * 0.07)); }
  good() { [523, 784].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.08, i * 0.12)); }
  bad() { this.tone(196, 0.5, 'triangle', 0.1, 0, -60); }
  collapse() { [110, 104, 82].forEach((f, i) => this.tone(f, 1.6, 'sawtooth', 0.07, i * 0.5, -10)); this.noise(2.5, 200, 0.1); }
  arrive(ok) { (ok ? [392, 494, 587, 784] : [294, 277, 220]).forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.09, i * 0.14)); }
}
