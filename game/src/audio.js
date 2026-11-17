// audio.js — procedural WebAudio sounds for Porto Verde. No audio files.

const AudioSys = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  started: false,
};

function initAudio() {
  if (AudioSys.ctx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    AudioSys.ctx = new Ctx();
    AudioSys.master = AudioSys.ctx.createGain();
    AudioSys.master.gain.value = 0.5;
    AudioSys.master.connect(AudioSys.ctx.destination);
    // Engine hum: two detuned sawtooths through a lowpass.
    AudioSys.engineOsc = AudioSys.ctx.createOscillator();
    AudioSys.engineOsc.type = 'sawtooth';
    AudioSys.engineOsc.frequency.value = 55;
    const lp = AudioSys.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    AudioSys.engineGain = AudioSys.ctx.createGain();
    AudioSys.engineGain.gain.value = 0.0;
    AudioSys.engineOsc.connect(lp); lp.connect(AudioSys.engineGain); AudioSys.engineGain.connect(AudioSys.master);
    AudioSys.engineOsc.start();
    // Police siren: alternating two-tone triangle wave.
    AudioSys.sirenOsc = AudioSys.ctx.createOscillator();
    AudioSys.sirenOsc.type = 'triangle';
    AudioSys.sirenOsc.frequency.value = 700;
    AudioSys.sirenGain = AudioSys.ctx.createGain();
    AudioSys.sirenGain.gain.value = 0.0;
    AudioSys.sirenOsc.connect(AudioSys.sirenGain); AudioSys.sirenGain.connect(AudioSys.master);
    AudioSys.sirenOsc.start();
    AudioSys.started = true;
  } catch (err) { /* audio unavailable: game stays silent */ }
}

function resumeAudio() {
  if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
}

function updateAudio(dt) {
  if (!AudioSys.ctx || !AudioSys.started) return;
  AudioSys.master.gain.value = V.muted ? 0 : 0.5;
  const speed = V.activeCar ? Math.abs(V.activeCar.speed) : 0;
  const target = V.activeCar ? clamp(0.05 + speed / 220, 0, 0.16) : 0;
  AudioSys.engineGain.gain.value = lerp(AudioSys.engineGain.gain.value, target, dt * 4);
  AudioSys.engineOsc.frequency.value = 50 + speed * 4.2;
  const sirenOn = V.wanted > 0 && V.police.length > 0;
  AudioSys.sirenGain.gain.value = lerp(AudioSys.sirenGain.gain.value, sirenOn ? 0.05 : 0, dt * 3);
  if (sirenOn) AudioSys.sirenOsc.frequency.value = 650 + 250 * Math.sin(V.time * 4.5);
}

function noiseBurst(duration, volume, filterFreq) {
  if (!AudioSys.ctx || V.muted) return;
  const ctx = AudioSys.ctx;
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq || 1800;
  const g = ctx.createGain(); g.gain.value = volume;
  src.connect(f); f.connect(g); g.connect(AudioSys.master);
  src.start();
}

function tone(freq, duration, volume, type) {
  if (!AudioSys.ctx || V.muted) return;
  const ctx = AudioSys.ctx;
  const o = ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  o.connect(g); g.connect(AudioSys.master);
  o.start(); o.stop(ctx.currentTime + duration);
}

function sfxShot() { noiseBurst(0.14, 0.5, 2600); tone(180, 0.08, 0.25, 'square'); }
function sfxHit() { tone(320, 0.1, 0.3, 'square'); }
function sfxPickup() { tone(660, 0.12, 0.3); setTimeout(() => tone(990, 0.18, 0.3), 90); }
function sfxCrash() { noiseBurst(0.3, 0.6, 900); }
function sfxClick() { tone(880, 0.05, 0.2, 'square'); }
function sfxMission() { tone(523, 0.15, 0.3); setTimeout(() => tone(659, 0.15, 0.3), 130); setTimeout(() => tone(784, 0.3, 0.3), 260); }
function sfxBusted() { tone(220, 0.5, 0.35, 'sawtooth'); setTimeout(() => tone(165, 0.8, 0.35, 'sawtooth'), 400); }
