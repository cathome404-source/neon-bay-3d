// Synthesized sound for Neon Bay 3D: a tiny WebAudio radio with three stations
// plus engine hum, impacts and jingles — no audio files anywhere.
// Exports: createAudio.

import { RADIO_STATIONS } from './config.js';

// A minor pentatonic ladder, in hertz, from A3 up two octaves.
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];

// Eight-step melodies, one per station: 0 means rest on that step.
const PATTERNS = [
  [0, 4, 0, 6, 7, 0, 5, 3],
  [0, 2, 4, 0, 3, 0, 2, 0],
  [5, 0, 4, 0, 6, 5, 0, 7],
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let station = 0;
  let radioTimer = null;
  let radioStep = 0;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineOn = false;

  function ensureNoise() {
    if (noiseBuf || !ctx) return;
    const length = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx) return;
    const t0 = when === undefined ? ctx.currentTime : when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, filterType, when) {
    if (!ctx) return;
    ensureNoise();
    const t0 = when === undefined ? ctx.currentTime : when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType || 'bandpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---------- radio ----------
  function radioTick() {
    if (!ctx) return;
    const stationDef = RADIO_STATIONS[station];
    const pattern = PATTERNS[station % PATTERNS.length];
    const degree = pattern[radioStep % pattern.length];
    const stepDur = 60 / stationDef.tempo / 2;
    if (degree > 0) {
      tone(SCALE[degree % SCALE.length], stepDur * 0.9, stationDef.wave, 0.05);
    }
    if (radioStep % 4 === 0) {
      tone(SCALE[0] / 2, stepDur * 1.8, 'sine', 0.07);
    }
    radioStep += 1;
  }

  function startRadio() {
    if (!ctx || radioTimer) return;
    radioStep = 0;
    const stepDur = 60 / RADIO_STATIONS[station].tempo / 2;
    radioTimer = setInterval(radioTick, stepDur * 1000);
  }

  function stopRadio() {
    if (radioTimer) {
      clearInterval(radioTimer);
      radioTimer = null;
    }
  }

  function resume() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.9;
        master.connect(ctx.destination);
        ensureNoise();
        startRadio();
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (err) {
      /* audio is best-effort */
    }
  }

  function setStation(i) {
    station = ((i % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    if (radioTimer) {
      stopRadio();
      startRadio();
    }
  }

  function nextStation() {
    setStation(station + 1);
  }

  // ---------- engine ----------
  function engine(speed, on) {
    if (!ctx) return;
    try {
      if (on && !engineOn) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain.gain.value = 0.045;
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 320;
        engineOsc.connect(low);
        low.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
        engineOn = true;
      }
      if (!on && engineOn) {
        engineOsc.stop();
        engineOsc = null;
        engineGain = null;
        engineOn = false;
        return;
      }
      if (engineOn) {
        const target = 50 + Math.abs(speed) * 3.2;
        engineOsc.frequency.setTargetAtTime(target, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.03 + Math.min(0.05, Math.abs(speed) * 0.0012), ctx.currentTime, 0.1);
      }
    } catch (err) {
      /* audio is best-effort */
    }
  }

  // ---------- one-shots ----------
  function skid() {
    noise(0.28, 0.16, 900, 'bandpass');
  }

  function door() {
    tone(170, 0.09, 'sine', 0.22);
    tone(110, 0.12, 'sine', 0.2, ctx ? ctx.currentTime + 0.09 : undefined);
  }

  function shoot(weapon) {
    if (weapon === 'shotgun') {
      noise(0.32, 0.4, 700, 'lowpass');
      tone(70, 0.18, 'sine', 0.3, undefined, 40);
    } else if (weapon === 'smg') {
      noise(0.07, 0.22, 2400, 'bandpass');
    } else {
      noise(0.13, 0.3, 1800, 'bandpass');
      tone(140, 0.1, 'sine', 0.18, undefined, 60);
    }
  }

  function punch() {
    tone(95, 0.13, 'sine', 0.35, undefined, 55);
  }

  function crash() {
    noise(0.45, 0.4, 500, 'lowpass');
    tone(60, 0.5, 'sine', 0.4, undefined, 32);
  }

  function cash() {
    if (!ctx) return;
    tone(880, 0.12, 'sine', 0.2);
    tone(1318.5, 0.18, 'sine', 0.2, ctx.currentTime + 0.1);
  }

  function missionComplete() {
    if (!ctx) return;
    const now = ctx.currentTime;
    tone(523.25, 0.16, 'triangle', 0.25, now);
    tone(659.25, 0.16, 'triangle', 0.25, now + 0.14);
    tone(783.99, 0.3, 'triangle', 0.28, now + 0.28);
  }

  function setMuted(next) {
    muted = !!next;
    if (master) master.gain.value = muted ? 0 : 0.9;
  }

  // Names the actor system uses for its sound effects.
  function play(name) {
    if (!ctx) return;
    try {
      if (name === 'punch') punch();
      else if (name === 'shot') shoot('pistol');
      else if (name === 'enter' || name === 'exit') door();
      else if (name === 'ram') crash();
      else if (name === 'heli') {
        tone(140, 0.15, 'sine', 0.12, undefined, 90);
        tone(140, 0.15, 'sine', 0.12, ctx.currentTime + 0.2, 90);
      }
    } catch (err) {
      /* audio is best-effort */
    }
  }

  return {
    resume,
    setStation,
    nextStation,
    engine,
    skid,
    door,
    shoot,
    punch,
    crash,
    cash,
    missionComplete,
    setMuted,
    play,
  };
}
