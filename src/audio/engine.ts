import type { SfxName } from '../types';

export interface AudioSettings {
  master: number;
  music: number;
  effects: number;
  musicEnabled: boolean;
  effectsEnabled: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  master: 0.8,
  music: 0.45,
  effects: 0.85,
  musicEnabled: true,
  effectsEnabled: true,
};

/**
 * Web Audio synth engine. All SFX are generated with oscillators + noise
 * envelopes — no audio files, no copyrighted material. A light procedural
 * looped pad is used for music.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private musicNodes: { stop: () => void } | null = null;
  private muted = false;

  /** Must be called from a user gesture at least once. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setSettings(s: AudioSettings): void {
    this.settings = { ...s };
    this.applyVolumes();
    if (s.musicEnabled) this.ensureMusic();
    else this.stopMusic();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const master = this.muted ? 0 : this.settings.master;
    this.masterGain.gain.setTargetAtTime(master, t, 0.03);
    this.musicGain.gain.setTargetAtTime(master * this.settings.music * (this.settings.musicEnabled ? 1 : 0), t, 0.05);
    this.sfxGain.gain.setTargetAtTime(master * this.settings.effects * (this.settings.effectsEnabled ? 1 : 0), t, 0.03);
  }

  private getNoise(): AudioBuffer {
    const ctx = this.ctx!;
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  private tone(opts: {
    type?: OscillatorType;
    freq: number;
    freqEnd?: number;
    dur: number;
    vol?: number;
    delay?: number;
    attack?: number;
    dest?: GainNode;
  }): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + opts.dur);
    }
    const vol = opts.vol ?? 0.2;
    const a = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g);
    g.connect(opts.dest ?? this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  private noise(opts: {
    dur: number;
    vol?: number;
    filter?: BiquadFilterType;
    freq?: number;
    freqEnd?: number;
    q?: number;
    delay?: number;
  }): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise();
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.filter ?? 'lowpass';
    filt.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.freqEnd !== undefined) filt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), t0 + opts.dur);
    filt.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.3;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(filt); filt.connect(g); g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  play(name: SfxName): void {
    if (!this.ctx) return;
    this.unlock();
    switch (name) {
      case 'laser':
        this.tone({ type: 'sawtooth', freq: 880, freqEnd: 140, dur: 0.16, vol: 0.16 });
        break;
      case 'shoot':
        this.tone({ type: 'square', freq: 220, freqEnd: 440, dur: 0.08, vol: 0.14 });
        break;
      case 'explosion':
        this.noise({ dur: 0.5, vol: 0.5, filter: 'lowpass', freq: 1600, freqEnd: 90 });
        this.tone({ type: 'sine', freq: 110, freqEnd: 40, dur: 0.4, vol: 0.3 });
        break;
      case 'hit':
        this.tone({ type: 'square', freq: 160, freqEnd: 70, dur: 0.09, vol: 0.22 });
        this.noise({ dur: 0.08, vol: 0.18, filter: 'bandpass', freq: 500, q: 2 });
        break;
      case 'thud':
        this.tone({ type: 'sine', freq: 90, freqEnd: 45, dur: 0.18, vol: 0.3 });
        break;
      case 'coin':
        this.tone({ type: 'square', freq: 988, dur: 0.07, vol: 0.15 });
        this.tone({ type: 'square', freq: 1319, dur: 0.14, vol: 0.15, delay: 0.07 });
        break;
      case 'point':
        this.tone({ type: 'triangle', freq: 660, dur: 0.06, vol: 0.14 });
        break;
      case 'score':
        [523, 659, 784].forEach((f, i) => this.tone({ type: 'square', freq: f, dur: 0.1, vol: 0.13, delay: i * 0.07 }));
        break;
      case 'powerup':
        [392, 523, 659, 784].forEach((f, i) => this.tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.16, delay: i * 0.06 }));
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'sawtooth', freq: f, dur: 0.22, vol: 0.16, delay: i * 0.16 }));
        break;
      case 'select':
        this.tone({ type: 'square', freq: 520, dur: 0.05, vol: 0.1 });
        break;
      case 'start':
        [262, 392, 523, 784].forEach((f, i) => this.tone({ type: 'square', freq: f, dur: 0.09, vol: 0.14, delay: i * 0.05 }));
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.15, delay: i * 0.08 }));
        break;
      case 'click':
        this.tone({ type: 'square', freq: 300, dur: 0.035, vol: 0.08 });
        break;
      case 'tick':
        this.tone({ type: 'sine', freq: 1000, dur: 0.03, vol: 0.06 });
        break;
      case 'danger':
        this.tone({ type: 'sawtooth', freq: 120, dur: 0.3, vol: 0.18 });
        this.tone({ type: 'sawtooth', freq: 90, dur: 0.3, vol: 0.18, delay: 0.32 });
        break;
      case 'win':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ type: 'square', freq: f, dur: 0.14, vol: 0.15, delay: i * 0.09 }));
        break;
      default:
        break;
    }
  }

  /** Lightweight procedural pad loop. */
  private ensureMusic(): void {
    if (!this.ctx || this.musicNodes) return;
    void this.ctx.resume();
    const ctx = this.ctx;
    // Two slow detuned saws through a lowpass, plus a slow pulse LFO on filter.
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.gain.setTargetAtTime(0.16, ctx.currentTime, 0.6);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    filt.Q.value = 1.1;
    const oscs: OscillatorNode[] = [];
    const base = 110; // A2
    [1, 1.5, 2].forEach((ratio, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = base * ratio * (i === 1 ? 0.999 : 1.001);
      const og = ctx.createGain();
      og.gain.value = i === 0 ? 0.5 : 0.22;
      o.connect(og); og.connect(filt);
      o.start();
      oscs.push(o);
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
    lfo.start();
    filt.connect(g); g.connect(this.musicGain!);
    this.musicNodes = {
      stop: () => {
        try {
          g.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
          window.setTimeout(() => {
            oscs.forEach((o) => {
              try { o.stop(); } catch { /* noop */ }
            });
            try { lfo.stop(); } catch { /* noop */ }
            g.disconnect(); filt.disconnect(); lfo.disconnect(); lfoGain.disconnect();
          }, 700);
        } catch { /* noop */ }
      },
    };
    void oscs;
  }

  stopMusic(): void {
    if (this.musicNodes) {
      try { this.musicNodes.stop(); } catch { /* noop */ }
      this.musicNodes = null;
    }
  }

  get musicPlaying(): boolean {
    return this.musicNodes !== null;
  }
}

export const audio = new AudioEngine();
