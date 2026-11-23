// WebAudio-synthesised sound only: engine, siren, helicopter, gunshot, pickup,
// mission jingle, and a 3-station radio loop. No audio files, no network.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.heliGain = null;
    this.radioOn = false;
    this.radioStation = 0;
    this.radioTimer = null;
    this.radioStep = 0;
    this.muted = false;
  }
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900;
      this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 60;
      this.engineOsc2 = this.ctx.createOscillator(); this.engineOsc2.type = 'sawtooth'; this.engineOsc2.frequency.value = 91;
      this.engineOsc.connect(filt); this.engineOsc2.connect(filt);
      filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); this.engineOsc2.start();
      // Siren: triangle that alternates 700/950 Hz.
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this._sirenPhase = false;
      setInterval(() => {
        if (!this.sirenOsc) return;
        this._sirenPhase = !this._sirenPhase;
        this.sirenOsc.frequency.value = this._sirenPhase ? 950 : 700;
      }, 380);
      // Helicopter: chopped noise via a square LFO on a noise buffer.
      const len = this.ctx.sampleRate * 0.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.8;
      this.heliGain = this.ctx.createGain(); this.heliGain.gain.value = 0;
      noise.connect(bp); bp.connect(this.heliGain); this.heliGain.connect(this.master);
      noise.start();
    } catch {
      this.ctx = null;
    }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setEngine(speedNorm, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + speedNorm * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(83 + speedNorm * 190, t, 0.1);
  }
  setSiren(level) { // 0..1 by police proximity
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(level * 0.05, this.ctx.currentTime, 0.3);
  }
  setHeli(level) {
    if (!this.ctx) return;
    this.heliGain.gain.setTargetAtTime(level * 0.07, this.ctx.currentTime, 0.3);
  }
  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.12));
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + (dur || 0.12) + 0.02);
  }
  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    const g = this.ctx.createGain(); g.gain.value = 0.5;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    this.blip(120, 0.1, 'square', 0.25);
  }
  pickup() { this.blip(880, 0.1, 'sine', 0.25); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.25), 90); }
  // Tyre skid: a short burst of filtered noise, throttled by the caller.
  skid() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.22);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    const g = this.ctx.createGain(); g.gain.value = 0.22;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  // Car door: a low thunk followed by a softer click.
  door() { this.blip(180, 0.09, 'square', 0.25); setTimeout(() => this.blip(320, 0.07, 'square', 0.15), 70); }
  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.18, 'triangle', 0.3), i * 110));
  }
  fail() { this.blip(220, 0.25, 'sawtooth', 0.2); setTimeout(() => this.blip(165, 0.35, 'sawtooth', 0.2), 180); }
  // Radio: a tiny step sequencer, 3 stations with different bass patterns/tempos.
  toggleRadio() {
    if (!this.ctx) return false;
    this.radioOn = !this.radioOn;
    if (this.radioOn) {
      const patterns = [
        { bpm: 112, bass: [55, 0, 65.4, 0, 49, 0, 73.4, 0], lead: [220, 277, 330, 262] },
        { bpm: 96, bass: [41.2, 0, 0, 55, 0, 0, 49, 61.7], lead: [196, 220, 247, 196] },
        { bpm: 128, bass: [65.4, 65.4, 0, 82.4, 0, 65.4, 98, 0], lead: [262, 311, 392, 330] },
      ];
      const pat = patterns[this.radioStation % patterns.length];
      const stepDur = 60 / pat.bpm / 2;
      this.radioStep = 0;
      this.radioTimer = setInterval(() => {
        if (!this.radioOn || !this.ctx) return;
        const i = this.radioStep % 8;
        const b = pat.bass[i];
        if (b) this.blip(b, stepDur * 0.9, 'square', 0.12);
        if (this.radioStep % 4 === 0) this.blip(pat.lead[(this.radioStep / 4 | 0) % 4], stepDur * 1.5, 'triangle', 0.07);
        this.radioStep += 1;
      }, stepDur * 1000);
      return true;
    }
    if (this.radioTimer) clearInterval(this.radioTimer);
    this.radioTimer = null;
    return false;
  }
  nextStation() {
    this.radioStation = (this.radioStation + 1) % 3;
    if (this.radioOn && this.radioTimer) { this.toggleRadio(); this.toggleRadio(); }
    return this.radioStation;
  }
}
