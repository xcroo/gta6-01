// Dusthaven — audio.js
// Procedural WebAudio sound: no audio files are shipped. Engine hum,
// police sirens, gunshots, pickups and UI blips are all synthesized
// from oscillators and filtered noise, so the game stays fully offline.
var DH = window.DH || (window.DH = {});

DH.audio = (function () {
  'use strict';

  var ctx = null;
  var master = null;
  var engineOsc = null;
  var engineOsc2 = null;
  var engineGain = null;
  var engineFilter = null;
  var sirenOsc = null;
  var sirenGain = null;
  var sirenOn = false;
  var sirenPhase = 0;
  var radioOn = false;
  var radioTimer = 0;
  var radioNotes = [0, 3, 5, 7, 10, 12, 10, 7, 5, 3];
  var radioStep = 0;
  var muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      buildEngine();
      buildSiren();
    } catch (e) {
      ctx = null;
      return false;
    }
    return true;
  }

  function buildEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
  }

  function buildSiren() {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 760;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  // Engine pitch and loudness follow how fast the player is moving (0..1).
  function setEngine(amount, inCar) {
    if (!ctx || !engineGain) return;
    var target = inCar ? 0.05 + amount * 0.11 : 0.0;
    engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(52 + amount * 165, ctx.currentTime, 0.06);
    engineOsc2.frequency.setTargetAtTime(26 + amount * 82, ctx.currentTime, 0.06);
    engineFilter.frequency.setTargetAtTime(320 + amount * 1400, ctx.currentTime, 0.1);
  }

  function setSiren(on) {
    sirenOn = on;
    if (!ctx || !sirenGain) return;
    sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0.0, ctx.currentTime, 0.2);
  }

  // Two-tone wail, advanced from the game loop so it stays in sync.
  function updateSiren(dt) {
    if (!ctx || !sirenOsc) return;
    if (!sirenOn) return;
    sirenPhase += dt * 1.6;
    var hi = Math.sin(sirenPhase * Math.PI) > 0;
    sirenOsc.frequency.setTargetAtTime(hi ? 960 : 690, ctx.currentTime, 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq || 2400;
    var g = ctx.createGain();
    g.gain.value = muted ? 0 : vol;
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(muted ? 0 : vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function shot() {
    noiseBurst(0.14, 0.5, 3200);
    tone(160, 0.08, 'square', 0.25, 60);
  }

  function punch() {
    noiseBurst(0.08, 0.3, 900);
    tone(120, 0.1, 'sine', 0.3, 70);
  }

  function crash() {
    noiseBurst(0.3, 0.5, 700);
    tone(90, 0.25, 'sawtooth', 0.2, 40);
  }

  function blip() {
    tone(880, 0.09, 'sine', 0.22, 1320);
  }

  function pickup() {
    tone(660, 0.1, 'sine', 0.25);
    setTimeout(function () { tone(990, 0.14, 'sine', 0.25); }, 90);
  }

  function cash() {
    tone(1046, 0.09, 'triangle', 0.25);
    setTimeout(function () { tone(1318, 0.09, 'triangle', 0.25); }, 80);
    setTimeout(function () { tone(1568, 0.16, 'triangle', 0.25); }, 160);
  }

  function busted() {
    tone(392, 0.3, 'sawtooth', 0.2, 196);
    setTimeout(function () { tone(311, 0.4, 'sawtooth', 0.2, 155); }, 220);
  }

  // Tiny desert-blues radio loop: a lazy pentatonic riff over a low drone.
  function setRadio(on) {
    radioOn = on;
  }

  function updateRadio(dt) {
    if (!ctx || !radioOn || muted) return;
    radioTimer -= dt;
    if (radioTimer > 0) return;
    radioTimer = 0.24;
    var base = 220;
    var step = radioNotes[radioStep % radioNotes.length];
    radioStep++;
    tone(base * Math.pow(2, step / 12), 0.22, 'triangle', 0.10);
    if (radioStep % 8 === 1) tone(110, 0.5, 'sine', 0.08);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  function update(dt) {
    updateSiren(dt);
    updateRadio(dt);
  }

  return {
    ensure: ensure,
    setEngine: setEngine,
    setSiren: setSiren,
    shot: shot,
    punch: punch,
    crash: crash,
    blip: blip,
    pickup: pickup,
    cash: cash,
    busted: busted,
    setRadio: setRadio,
    toggleMute: toggleMute,
    update: update
  };
})();
