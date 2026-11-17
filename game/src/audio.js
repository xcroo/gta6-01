// SOLMARA — audio.js
// All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, siren, gunshots, footsteps, UI clicks and mission stings.

var AudioSys = {
  ctx: null, master: null, engineOsc: null, engineGain: null, sirenOsc: null,
  sirenGain: null, sirenLfo: null, started: false,

  init: function () {
    if (this.ctx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: two detuned saws through a low-pass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      var engineOsc2 = this.ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      var filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filt); engineOsc2.connect(filt);
      filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); engineOsc2.start();
      this.engineOsc2 = engineOsc2;
      // Siren: sine wobbling between two tones while wanted.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.9;
      var lfoGain = this.ctx.createGain(); lfoGain.gain.value = 180;
      this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); this.sirenLfo.start();
      this.started = true;
    } catch (e) { /* audio unavailable: game stays silent */ }
  },

  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  setEngine: function (speed01, on) {
    if (!this.ctx || !this.engineOsc || !this.engineOsc2) return;
    var t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(26 + speed01 * 60, t, 0.08);
  },

  setSiren: function (on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  },

  // One-shot noise burst (gunshot, thud, crash).
  burst: function (freq, dur, vol, type) {
    if (!this.ctx || G.muted) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * dur);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource(); src.buffer = buf;
    var f = this.ctx.createBiquadFilter();
    f.type = type || 'lowpass'; f.frequency.value = freq;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  // Short tone (click, beep, chime note).
  tone: function (freq, dur, vol, type, slideTo) {
    if (!this.ctx || G.muted) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  gunshot: function () { this.burst(900, 0.16, 0.5, 'lowpass'); this.tone(160, 0.08, 0.25, 'square', 60); },
  distantShot: function () { this.burst(500, 0.12, 0.12, 'lowpass'); },
  crash: function () { this.burst(300, 0.35, 0.5, 'lowpass'); this.tone(70, 0.25, 0.3, 'sine', 40); },
  click: function () { this.tone(660, 0.05, 0.15, 'square'); },
  pickup: function () { this.tone(880, 0.1, 0.2, 'sine'); this.tone(1320, 0.16, 0.2, 'sine'); },
  missionOk: function () {
    var self = this;
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { self.tone(f, 0.22, 0.22, 'triangle'); }, i * 110);
    });
  },
  missionFail: function () {
    var self = this;
    [392, 330, 262].forEach(function (f, i) {
      setTimeout(function () { self.tone(f, 0.3, 0.2, 'sawtooth'); }, i * 140);
    });
  },
  horn: function () { this.tone(370, 0.18, 0.18, 'square'); this.tone(466, 0.18, 0.18, 'square'); },
  footstep: function () { this.burst(200, 0.06, 0.06, 'lowpass'); },
};
