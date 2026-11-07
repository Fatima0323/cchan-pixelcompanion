// 提示音库：全部用 Web Audio 现场合成（没有任何外部音频文件）
// 分三类，每类对应一个事件；同一类里随机挑，但不会和上一次播的重复
(function (root) {
  'use strict';
  const SR = 44100;

  // 一个"分音"：正弦/三角波，快速起音 + 指数衰减（decay = 衰减到 -60dB 的秒数）
  function partial(ctx, out, freq, gain, decay, o = {}) {
    const t0 = (o.start || 0) + 0.01;
    const attack = o.attack || 0.004;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    if (o.pitchDrop) {
      osc.frequency.setValueAtTime(freq * (1 + o.pitchDrop), t0);
      osc.frequency.setTargetAtTime(freq, t0, 1 / 40);
    } else {
      osc.frequency.setValueAtTime(freq, t0);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setTargetAtTime(0, t0 + attack, decay / 6.9);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + decay + 0.1);
  }

  const SOUNDS = {
    glass:    { name: '玻璃叮', dur: 2.0, build(c, o) { const f = 1318.5; partial(c, o, f, .55, 1.6); partial(c, o, f * 2, .12, .7); partial(c, o, f * 2.76, .05, .35); partial(c, o, f * .5, .08, .9); } },
    piano:    { name: '柔和钢琴', dur: 2.0, build(c, o) { const f = 1046.5; [[1, .6, 1.5], [2, .25, .9], [3, .1, .5], [4, .05, .3]].forEach(([k, g, d]) => partial(c, o, f * k, g, d, { attack: .003 })); } },
    rise:     { name: '双音上扬', dur: 1.8, build(c, o) { partial(c, o, 783.99, .5, .8); partial(c, o, 1568, .12, .4); partial(c, o, 1046.5, .55, 1.2, { start: .15 }); partial(c, o, 2093, .12, .5, { start: .15 }); } },
    arp:      { name: '三连琶音', dur: 1.8, build(c, o) { [1046.5, 1318.5, 1568].forEach((f, i) => { partial(c, o, f, .45, i < 2 ? .9 : 1.3, { start: i * .09 }); partial(c, o, f * 2, .08, .4, { start: i * .09 }); }); } },
    kalimba:  { name: '卡林巴', dur: 1.6, build(c, o) { const f = 659.25; partial(c, o, f, .7, 1.1, { attack: .002, pitchDrop: .02 }); partial(c, o, f * 5.4, .12, .15, { attack: .001 }); partial(c, o, f * 2, .06, .4); } },
    musicbox: { name: '音乐盒', dur: 1.8, build(c, o) { [[2093, 0], [2637, .14]].forEach(([f, s]) => { partial(c, o, f, .5, .95, { attack: .001, start: s }); partial(c, o, f * 3, .08, .25, { attack: .001, start: s }); }); } },
    fm:       { name: '电子叮', dur: 1.4, build(c, o) {
      const t0 = .01, fc = 1046.5, fmod = fc * 3.5;
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.frequency.value = fc; mod.frequency.value = fmod;
      mg.gain.setValueAtTime(3 * fmod, t0); mg.gain.setTargetAtTime(0, t0, 1 / 9);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.7, t0 + .002); g.gain.setTargetAtTime(0, t0 + .002, .9 / 6.9);
      mod.connect(mg).connect(car.frequency); car.connect(g).connect(o);
      car.start(t0); mod.start(t0); car.stop(t0 + 1.2); mod.stop(t0 + 1.2);
    } },
    // ---- 柔和的提醒音（需要确认时默认用这几个）：起音慢一点、没有刺耳的高次泛音
    softbell: { name: '轻铃', dur: 2.0, build(c, o) { partial(c, o, 783.99, .5, 1.3, { attack: .018 }); partial(c, o, 1567.98, .06, .5, { attack: .02 }); partial(c, o, 1174.66, .38, 1.4, { attack: .02, start: .2 }); } },
    breeze:   { name: '微风', dur: 2.0, build(c, o) { [[659.25, 0], [880, .17], [987.77, .34]].forEach(([f, st]) => partial(c, o, f, .36, 1.1, { attack: .03, start: st })); } },
    hum:      { name: '轻声呼唤', dur: 1.8, build(c, o) { partial(c, o, 523.25, .45, 1.2, { attack: .05 }); partial(c, o, 783.99, .35, 1.2, { attack: .06, start: .12 }); partial(c, o, 1046.5, .05, .6, { attack: .06, start: .12 }); } },
    alert:    { name: '提醒双音', dur: 1.0, build(c, o) { partial(c, o, 987.8, .4, .5, { type: 'triangle', attack: .006 }); partial(c, o, 1318.5, .4, .7, { type: 'triangle', attack: .006, start: .16 }); } },
    marimba:  { name: '马林巴', dur: 1.0, build(c, o) { const f = 880; partial(c, o, f, .7, .55, { attack: .002 }); partial(c, o, f * 4, .18, .12, { attack: .001 }); partial(c, o, f * 9.2, .04, .05, { attack: .001 }); } },
    pop:      { name: '轻点', dur: 0.6, build(c, o) { partial(c, o, 1568, .6, .18, { attack: .001 }); partial(c, o, 3136, .12, .06, { attack: .001 }); partial(c, o, 784, .15, .12, { attack: .002 }); } },
  };

  const CATEGORIES = {
    done:    { name: '完成', desc: '温暖、有落地感', ids: ['glass', 'piano', 'rise', 'arp', 'kalimba'], level: 1.0 },
    confirm: { name: '需要确认', desc: '柔和地叫你一声', ids: ['softbell', 'breeze', 'hum', 'musicbox', 'fm', 'alert'], level: 0.7 },
    start:   { name: '开始工作', desc: '短、轻', ids: ['marimba', 'pop'], level: 0.45 },
  };

  // 简单混响：衰减白噪声做冲激响应（固定种子，保证每次一样）
  function makeIR(ctx, length = 0.7) {
    const n = Math.floor(length * ctx.sampleRate);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 7;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; };
    for (let i = 0; i < n; i++) d[i] = rnd() * Math.exp(-(i / ctx.sampleRate) * 6.9 / length);
    return buf;
  }

  // 离线渲染成 AudioBuffer，并把峰值统一到 0.8（各音量感一致）
  async function render(id) {
    const def = SOUNDS[id];
    const len = Math.ceil(def.dur * SR);
    const ctx = new OfflineAudioContext(1, len, SR);
    const dry = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = makeIR(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    dry.connect(ctx.destination);
    dry.connect(conv).connect(wet).connect(ctx.destination);
    def.build(ctx, dry);
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const k = peak > 0 ? 0.8 / peak : 1;
    const fade = Math.floor(0.05 * SR);
    for (let i = 0; i < d.length; i++) {
      d[i] *= k;
      if (i > d.length - fade) d[i] *= (d.length - i) / fade;
    }
    return buf;
  }

  class SoundBank {
    constructor(getCtx) {
      this.getCtx = getCtx;   // () => AudioContext（已解锁）
      this.cache = {};
      this.last = {};         // 类别 -> 上一次播的 id
      this.override = {};     // 类别 -> 用户上传的 AudioBuffer
    }

    buffer(id) {
      if (!this.cache[id]) this.cache[id] = render(id);
      return this.cache[id];
    }

    // 不重复随机：池里多于一个时，排除上一次那个
    pick(cat, pool) {
      const ids = (pool && pool.length ? pool : CATEGORIES[cat].ids).filter((id) => SOUNDS[id]);
      if (!ids.length) return null;
      const choices = ids.length > 1 ? ids.filter((id) => id !== this.last[cat]) : ids;
      const id = choices[Math.floor(Math.random() * choices.length)];
      this.last[cat] = id;
      return id;
    }

    async playId(id, volume = 0.6, level = 1) {
      const ctx = this.getCtx();
      const buf = await this.buffer(id);
      this.playBuffer(ctx, buf, volume * level);
      return id;
    }

    playBuffer(ctx, buf, gain) {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = gain;
      src.buffer = buf;
      src.connect(g).connect(ctx.destination);
      src.start();
    }

    async play(cat, pool, volume = 0.6) {
      const level = CATEGORIES[cat].level;
      if (this.override[cat]) { this.playBuffer(this.getCtx(), this.override[cat], volume * level); return 'custom'; }
      const id = this.pick(cat, pool);
      if (id) await this.playId(id, volume, level);
      return id;
    }
  }

  root.ClaudeChanSounds = { SOUNDS, CATEGORIES, SoundBank, render, SR };
})(typeof window !== 'undefined' ? window : globalThis);
