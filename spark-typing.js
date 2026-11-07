// Claude 娘 · Spark Typing —— 在 Claude / DeepSeek 的聊天框里打字时：
//   · 光标变成橙色（打得飞快时变紫）——这一步在 content.js 里用 caret-color 做
//   · 每个字从上面"砸"下来（和她生气时说话一样跳一下），字的颜色不变
//   · 光标处迸出一小撮像素火星：字越多颜色越浓（灰+一点橙 → 黄+橙 → 黑+橙+红），打得很快时混进紫色
//   · 打字机的声音（默认关，在设置里打开）
// 时间由外面推进（step(dt)），接在她的 requestAnimationFrame 循环里
(function (root) {
  'use strict';
  const P = 2;                       // 一个"像素"= 2 个 CSS 像素
  const snap = (v) => Math.round(v / P) * P;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  // ---------------------------------------------------------------- 颜色（每条是一颗火星从热到冷的变化）
  const RAMPS = {
    grey:   [['#f4f1ec', '#d9d3ca', '#b7afa4', '#958d82'], ['#ebe6de', '#c9c2b7', '#a39b90', '#857d73']],
    claude: [['#ffd9c6', '#eb9a76', '#d97757', '#b65a3c']],
    yellow: [['#fffbe6', '#fff1a8', '#ffd75e', '#ffb43c', '#ec8f2e'], ['#fff6c8', '#ffe27a', '#ffc548', '#f5a033', '#d97a28']],
    orange: [['#ffe6b8', '#ffb43c', '#ff8a3d', '#e8683a', '#c4502c']],
    red:    [['#ffe0a0', '#ff9a3d', '#f0503a', '#c42a22', '#7a1712'], ['#fff1b8', '#ff7a2f', '#e33a2a', '#a8201a', '#5c120e']],
    black:  [['#ff9a3d', '#b8341f', '#5a1d14', '#2a120d', '#140a08'], ['#ffb43c', '#8f2a1c', '#3d1610', '#1c0c09', '#0e0605']],
    purple: [['#ffffff', '#ead9ff', '#c39bff', '#9a66ff', '#6a35d9'], ['#f6ecff', '#d6b0ff', '#ad78ff', '#7c45f0', '#4a22a8'], ['#fbf6ff', '#e0c4ff', '#b98aff', '#8f55ff', '#5b2bc4']],
  };
  // 字数 → 现在用哪些颜色（中间平滑过渡，不会一下子跳变）
  //   0–20 字：灰 + 一点 Claude 橙；20–60：黄 + 橙；60 以后：黑 + 橙 + 红；120 以后：更多、更亮
  function tierOf(n) {
    if (n < 16) return 0;
    if (n < 24) return Math.random() < (n - 16) / 8 ? 1 : 0;
    if (n < 55) return 1;
    if (n < 65) return Math.random() < (n - 55) / 10 ? 2 : 1;
    if (n < 120) return 2;
    return 3;
  }
  function rampFor(tier) {
    if (tier === 0) return Math.random() < 0.22 ? pick(RAMPS.claude) : pick(RAMPS.grey);
    if (tier === 1) return Math.random() < 0.55 ? pick(RAMPS.yellow) : pick(RAMPS.orange);
    const r = Math.random();
    if (tier === 2) return r < 0.4 ? pick(RAMPS.red) : r < 0.7 ? pick(RAMPS.orange) : pick(RAMPS.black);
    return r < 0.35 ? pick(RAMPS.red) : r < 0.55 ? pick(RAMPS.black) : r < 0.8 ? pick(RAMPS.orange) : pick(RAMPS.yellow);
  }
  const col = (ramp, a) => ramp[Math.min(ramp.length - 1, Math.floor(clamp(a) * ramp.length))];

  // ---------------------------------------------------------------- 打字速度
  // 参考：英文平均 52 WPM，70 以上算熟练；中文拼音 60 字/分钟算普通，80–100 算快。
  // 但人是一边想一边打的：想的时候停一下，想好了就一口气打出一串。所以这里不看"平均速度"，
  // 只看"一口气打出来的那一串"有多快——
  //   · 停顿超过 1.5 秒 = 在想事情，从下一个字重新算，不会因为想事情被判成慢
  //   · 一串里最近两三个字的节奏够快就进紫色：英文约每秒 6 个字母（字和字之间 ≈0.17 秒），
  //     中文约每分钟 85 字（输入法一次上屏两三个字的话，两次上屏就能判断）
  //   · 进了紫色以后：每打一个还算快的字（门槛放低到 70%）就续 2 秒；完全停下来也会再亮 2 秒才退；
  //     想完接着打的头一两个字（还看不出快慢）也先续着，不会一停顿就掉
  const EN_CPS = 6, ZH_CPS = 85 / 60;
  const ENTER = 1.0, STAY = 0.7, HOLD = 2.0, THINK = 1.5;
  const isCJK = (ch) => /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/.test(ch);
  class Speed {
    constructor() { this.ev = []; this.fast = false; this.rate = 0; this.until = 0; }
    add(t, text) {
      if (this.ev.length && t - this.ev[this.ev.length - 1][0] > THINK) this.ev = [];   // 停下来想过：新的一串
      let en = 0, zh = 0;
      for (const ch of text) { if (isCJK(ch)) zh++; else en++; }
      this.ev.push([t, en / EN_CPS + zh / ZH_CPS]);              // 这一下 = 按"快"的节奏应该花多少秒
      if (this.ev.length > 4) this.ev.shift();
      // 最近这几下实际花的时间 vs. 按"快"的节奏该花的时间
      const ev = this.ev, n = ev.length;
      let r = 0;
      const multi = n >= 2 && ev[n - 1][1] >= 1.3;               // 输入法一次上屏好几个字
      if (n >= 3 || multi) {
        const span = Math.max(0.2, ev[n - 1][0] - ev[0][0]);
        r = ev.slice(1).reduce((a, e) => a + e[1], 0) / span;    // 1.0 = 刚好是"快"的节奏
      }
      this.rate = r;
      if (r >= ENTER || (this.fast && r >= STAY)) { this.fast = true; this.until = t + HOLD; }
      else if (this.fast && n < 3 && !multi) this.until = Math.max(this.until, t + 1.0);   // 刚想完接着打：先别急着退
    }
    update(t) {
      if (this.fast && t > this.until) this.fast = false;
      if (this.ev.length && t - this.ev[this.ev.length - 1][0] > THINK) this.rate = 0;
    }
  }

  // ---------------------------------------------------------------- 光标 / 字的位置
  const MIRROR_PROPS = ['boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'lineHeight', 'fontFamily',
    'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize', 'whiteSpace', 'wordBreak', 'overflowWrap'];
  let mirror = null;
  // textarea：用一个隐形的"镜子"div 照着排版，量出第 i 个字在哪
  function textareaRect(ta, i, caret) {
    if (!mirror) { mirror = document.createElement('div'); document.body.appendChild(mirror); }
    const cs = getComputedStyle(ta), ms = mirror.style;
    MIRROR_PROPS.forEach((p) => { ms[p] = cs[p]; });
    Object.assign(ms, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', height: 'auto' });
    const v = ta.value;
    mirror.textContent = v.slice(0, i);
    const mark = document.createElement('span'); mark.textContent = caret ? (v.slice(i) || '.') : v[i];
    mirror.appendChild(mark);
    if (!caret) mirror.appendChild(document.createTextNode(v.slice(i + 1)));
    const r = ta.getBoundingClientRect();
    const x = r.left + mark.offsetLeft - ta.scrollLeft, y = r.top + mark.offsetTop - ta.scrollTop;
    return caret ? { x, y, h: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4 } : { x, y, w: mark.offsetWidth, h: mark.offsetHeight };
  }
  function editableCaret(el) {
    const sel = document.getSelection();
    if (!sel || !sel.rangeCount || !el.contains(sel.focusNode)) return null;
    const rg = sel.getRangeAt(0).cloneRange(); rg.collapse(false);
    let r = rg.getClientRects()[0];
    if (!r || !r.height) {                       // 空行：临时放个零宽字符量一下
      const z = document.createTextNode('​'); rg.insertNode(z);
      const q = document.createRange(); q.selectNodeContents(z); r = q.getBoundingClientRect();
      z.remove();
    }
    return { x: r.left, y: r.top, h: r.height };
  }
  function caretOf(el) {
    if (!el) return null;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return textareaRect(el, el.selectionEnd, true);
    return editableCaret(el);
  }
  // 刚输入的那几个字：记下它们在哪（contenteditable 用 Range，会跟着文字自动挪；textarea 记序号）
  function justTyped(el, n) {
    const out = [];
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const end = el.selectionEnd;
      for (let i = Math.max(0, end - n); i < end; i++) out.push({ ta: el, i, ch: el.value[i] });
      return out;
    }
    const sel = document.getSelection();
    if (!sel || !sel.focusNode || sel.focusNode.nodeType !== 3) return out;
    const node = sel.focusNode, end = sel.focusOffset, s = node.data;
    // 往回数 n 个字（注意 emoji 这种占两个位置的）
    let i = end; const idx = [];
    while (i > 0 && idx.length < n) { let j = i - 1; if (j > 0 && /[\udc00-\udfff]/.test(s[j])) j--; idx.unshift([j, i]); i = j; }
    for (const [a, b] of idx) { const rg = document.createRange(); rg.setStart(node, a); rg.setEnd(node, b); out.push({ rg, ch: s.slice(a, b) }); }
    return out;
  }
  function bgOf(el) {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return '#fff';
  }

  // ---------------------------------------------------------------- 主体
  class Sparks {
    constructor(canvas, glyphCanvas) {
      this.cv = canvas; this.g = canvas.getContext('2d');
      this.gc = glyphCanvas; this.gg = glyphCanvas.getContext('2d');
      this.parts = []; this.glyphs = []; this.t = 0; this.lastType = -9;
      this.speed = new Speed();
      this.count = 0;                 // 输入框里现在有多少字
      this.onSound = null;            // (kind, info) => 放声音
      this.resize();
    }
    resize() {
      const dpr = root.devicePixelRatio || 1;
      this.w = innerWidth; this.h = innerHeight;
      for (const [c, g] of [[this.cv, this.g], [this.gc, this.gg]]) {
        c.width = Math.round(this.w * dpr); c.height = Math.round(this.h * dpr);
        c.style.width = this.w + 'px'; c.style.height = this.h + 'px';
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    // 小小的、往上方喷：尽量不挡住这一行的字
    dir(spread = 1) {
      const a = -Math.PI / 2 + rnd(-1.15, 1.15) * spread;
      return [Math.cos(a), Math.sin(a)];
    }
    dot(x, y, ramp, sp = 1, life = 1) {
      const [dx, dy] = this.dir(), v = rnd(55, 150) * sp;
      this.parts.push({ k: 'dot', x, y, vx: dx * v, vy: dy * v, age: 0, life: rnd(0.25, 0.45) * life, ramp, s: Math.random() < 0.15 ? 2 : 1 });
    }
    arc(x, y, ramp, sp = 1) {
      const [dx, dy] = this.dir(0.9), v = rnd(110, 190) * sp;
      this.parts.push({ k: 'arc', x, y, vx: dx * v, vy: dy * v, w: rnd(6, 12) * (Math.random() < 0.5 ? -1 : 1), age: 0, life: rnd(0.3, 0.45), ramp, trail: [[snap(x), snap(y)]], len: 5 });
    }
    star(x, y, ramp, big = false) {
      const [dx, dy] = this.dir(0.8), v = rnd(40, 90);
      this.parts.push({ k: 'star', x, y, vx: dx * v, vy: dy * v, age: 0, life: rnd(0.45, 0.7), ramp, s: big ? 2 : 1, ph: rnd(0, 6) });
    }
    busy() { return this.parts.length > 0 || this.glyphs.length > 0; }
    clear() { this.parts = []; this.glyphs = []; this.g.clearRect(0, 0, this.w, this.h); this.gg.clearRect(0, 0, this.w, this.h); }
    // 打了一个字（或者输入法一次上屏几个字）；paste = 粘贴进来的，不算打字速度、字也不跳
    typed(el, text, paste = false) {
      const c = caretOf(el); if (!c) return;
      const n = [...text].length;
      if (!paste) { this.speed.add(this.t, text); this.speed.update(this.t); }
      // 字跳出来（一次最多跳 12 个）
      if (!paste) {
        const fresh = justTyped(el, Math.min(n, 12));
        const fnode = el.tagName === 'TEXTAREA' ? el : ((document.getSelection().focusNode || el).parentElement || el);
        const cs = getComputedStyle(fnode);
        const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const bg = bgOf(fnode);
        fresh.forEach((f, i) => {
          if (!f.ch.trim()) return;
          // 先记下现在的位置：页面把这几个字重新排版（Range 失效）时就用它
          let r0 = null;
          if (f.rg) { const b = f.rg.getBoundingClientRect(); r0 = { left: b.left, top: b.top, width: b.width, height: b.height }; }
          this.glyphs.push(Object.assign(f, { r0, t0: this.t + i * 0.045, font, color: cs.color, bg, size: parseFloat(cs.fontSize) }));
        });
      }
      // 火星：从光标上半截冒出来
      const x = c.x, y = c.y + c.h * 0.3;
      const tier = tierOf(this.count);
      const k = Math.min(n, 3);
      const many = (m, f) => { for (let i = 0; i < m; i++) f(); };
      const T = () => tierOf(this.count);
      this.flash(x, y, tier, this.speed.fast);
      if (tier === 0) { many(2 + (k > 1 ? 1 : 0), () => this.dot(x, y, rampFor(T()))); if (Math.random() < 0.3) this.arc(x, y, rampFor(T()), 0.8); }
      else if (tier === 1) { many(3 + (k > 1 ? 1 : 0), () => this.dot(x, y, rampFor(T()))); this.arc(x, y, rampFor(T())); if (Math.random() < 0.25) this.star(x, y, pick(RAMPS.yellow)); }
      else if (tier === 2) { many(3 + (k > 1 ? 1 : 0), () => this.dot(x, y, rampFor(T()))); this.arc(x, y, rampFor(T())); this.dot(x, y, pick(RAMPS.black), 0.8, 1.3); if (Math.random() < 0.3) this.star(x, y, pick(RAMPS.red)); }
      else { many(4 + (k > 1 ? 1 : 0), () => this.dot(x, y, rampFor(3), 1.1)); many(2, () => this.arc(x, y, rampFor(3), 1.1)); this.dot(x, y, pick(RAMPS.black), 0.8, 1.4); if (Math.random() < 0.5) this.star(x, y, pick(RAMPS.yellow), Math.random() < 0.4); }
      if (this.speed.fast) {        // 极速：混进紫色
        many(2, () => this.dot(x, y, pick(RAMPS.purple), 1.2));
        this.arc(x, y, pick(RAMPS.purple), 1.2);
        if (Math.random() < 0.45) this.star(x, y, pick(RAMPS.purple), Math.random() < 0.3);
      }
      if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
      this.lastType = this.t;
      if (this.onSound) this.onSound('type', { tier, fast: this.speed.fast, n: k, space: !text.trim() || n > 1 });
    }
    deleted(el) {
      const c = caretOf(el); if (!c) return;
      for (let i = 0; i < 3; i++) this.parts.push({ k: 'dot', x: c.x + rnd(-2, 2), y: c.y + c.h * 0.5, vx: rnd(-20, 20), vy: rnd(-25, 5), age: 0, life: rnd(0.35, 0.6), ramp: pick(RAMPS.grey), s: 1, ash: true });
      this.lastType = this.t;
      if (this.onSound) this.onSound('delete', {});
    }
    sent(x, y) {
      const tier = tierOf(this.count);
      this.flash(x, y, Math.max(tier, 1), this.speed.fast, true);
      for (let i = 0; i < 14; i++) this.dot(x, y, rampFor(Math.max(tier, 1)), 1.5, 1.3);
      for (let i = 0; i < 5; i++) this.arc(x, y, rampFor(Math.max(tier, 1)), 1.4);
      for (let i = 0; i < 3; i++) this.star(x, y, pick(tier >= 2 ? RAMPS.red : RAMPS.yellow), true);
      if (this.onSound) this.onSound('send', { tier });
    }
    flash(x, y, tier, fast, big) {
      const ramp = fast ? RAMPS.purple[0] : tier === 0 ? RAMPS.grey[0] : tier === 1 ? RAMPS.yellow[0] : RAMPS.red[0];
      this.parts.push({ k: 'flash', x, y, age: 0, life: big ? 0.14 : 0.07, ramp, big });
    }

    step(dt) {
      this.t += dt;
      this.speed.update(this.t);
      const keep = [];
      for (const p of this.parts) {
        p.age += dt;
        if (p.age >= p.life) continue;
        if (p.k === 'dot') {
          if (p.ash) { p.vy += 70 * dt; p.vx *= Math.pow(0.3, dt); }
          else { p.vy += 160 * dt; p.vx *= Math.pow(0.15, dt); p.vy *= Math.pow(0.2, dt); }
        } else if (p.k === 'arc') {
          const c = Math.cos(p.w * dt), s = Math.sin(p.w * dt);
          [p.vx, p.vy] = [p.vx * c - p.vy * s, p.vx * s + p.vy * c];
          p.vx *= Math.pow(0.2, dt); p.vy *= Math.pow(0.2, dt);
        } else if (p.k === 'star') { p.vx *= Math.pow(0.05, dt); p.vy *= Math.pow(0.05, dt); p.vy -= 10 * dt; }
        if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
        if (p.k === 'arc') {
          const [lx, ly] = p.trail[p.trail.length - 1], nx = snap(p.x), ny = snap(p.y);
          let cx = lx, cy = ly;
          while (cx !== nx || cy !== ny) {          // 一格一格连起来，画出来是一条像素曲线
            const ddx = nx - cx, ddy = ny - cy;
            if (Math.abs(ddx) >= Math.abs(ddy)) cx += Math.sign(ddx) * P; else cy += Math.sign(ddy) * P;
            p.trail.push([cx, cy]);
          }
          if (p.trail.length > p.len) p.trail.splice(0, p.trail.length - p.len);
        }
        keep.push(p);
      }
      this.parts = keep;
      this.glyphs = this.glyphs.filter((gl) => this.t - gl.t0 < 0.4);
    }

    px(x, y, c, s = 1) { this.g.fillStyle = c; this.g.fillRect(x, y, P * s, P * s); }
    draw() {
      const g = this.g, gg = this.gg;
      g.clearRect(0, 0, this.w, this.h);
      gg.clearRect(0, 0, this.w, this.h);
      // ---- 字跳出来：先用底色盖住真正的字，再在上面画一个从高处砸下来、稍微大一点的同样的字
      for (const gl of this.glyphs) {
        const u0 = this.t - gl.t0;
        let r;
        if (gl.rg) {
          r = gl.rg.startContainer.isConnected ? gl.rg.getBoundingClientRect() : null;
          if (!r || !r.width) r = gl.r0;
        } else if (gl.ta.isConnected && gl.i < gl.ta.value.length) {
          const q = textareaRect(gl.ta, gl.i, false); r = { left: q.x, top: q.y, width: q.w, height: q.h };
        }
        if (!r || !r.width) continue;
        gg.fillStyle = gl.bg; gg.fillRect(r.left - 0.5, r.top, r.width + 1, r.height);
        if (u0 < 0) continue;                                  // 还没轮到它（输入法一次上屏几个字时一个接一个砸）
        const em = gl.size, LAND = 0.15;
        let dy, sc, a;
        if (u0 < LAND) { const u = u0 / LAND; dy = -0.85 * em * (1 - u * u); sc = 1.5 - 0.5 * u * u; a = Math.min(1, u / 0.35); }
        else { const v = clamp((u0 - LAND) / 0.22); dy = -0.16 * em * Math.sin(Math.PI * v) * (1 - v); sc = 1; a = 1; }
        gg.save();
        gg.font = gl.font; gg.fillStyle = gl.color; gg.globalAlpha = a; gg.textBaseline = 'alphabetic';
        const m = gg.measureText(gl.ch), asc = m.fontBoundingBoxAscent || em * 0.9;
        const cx = r.left + r.width / 2, by = r.top + asc;
        gg.translate(cx, by + dy); gg.scale(sc, sc);
        gg.textAlign = 'center'; gg.fillText(gl.ch, 0, 0);
        gg.restore();
      }
      // ---- 火星
      for (const p of this.parts) {
        const a = p.age / p.life;
        if (p.k === 'flash') {
          const x = snap(p.x), y = snap(p.y), c = col(p.ramp, a * 0.6);
          this.px(x, y, c); this.px(x - P, y, c); this.px(x + P, y, c); this.px(x, y - P, c);
          if (p.big) { const c2 = col(p.ramp, 0.5 + a * 0.4); this.px(x - 2 * P, y, c2); this.px(x + 2 * P, y, c2); this.px(x, y - 2 * P, c2); this.px(x, y + P, c); this.px(x, y + 2 * P, c2); }
        } else if (p.k === 'dot') {
          this.px(snap(p.x), snap(p.y), col(p.ramp, a), a > 0.55 ? 1 : p.s);
        } else if (p.k === 'arc') {
          const n = p.trail.length;
          p.trail.forEach(([x, y], i) => this.px(x, y, col(p.ramp, a * 0.55 + ((n - 1 - i) / p.len) * 0.6)));
        } else if (p.k === 'star') {
          // 四芒星：中心最亮，四条尖一闪一闪、慢慢缩短
          const x = snap(p.x), y = snap(p.y);
          const tw = Math.sin(p.age * 24 + p.ph) > 0 ? 1 : 0;
          const L = Math.max(0, p.s + tw - (a > 0.6 ? 1 : 0));
          for (let i = 1; i <= L; i++) {
            const c = col(p.ramp, 0.3 + a * 0.5 + (i === L ? 0.2 : 0));
            this.px(x + i * P, y, c); this.px(x - i * P, y, c); this.px(x, y + i * P, c); this.px(x, y - i * P, c);
          }
          this.px(x, y, col(p.ramp, a * 0.6));
        }
      }
    }
  }

  // ---------------------------------------------------------------- 声音（浏览器里现场合成）
  // 模仿老式打字机，但比真的打字机柔和、小声一些：
  //   字键：字锤打在纸和滚筒上的"哒"（短促的撞击 + 一点木头/铁皮壳子的共鸣 + 很淡的金属余音），紧接着字车往前走一格的"嗒"
  //   空格：不打字，只有字车走一格，闷闷的"嗒"
  //   退格：字车往回退，一声低一点的"咔"
  //   发送：换行——一声轻轻的"叮"，再是字车被推回去的"哗啦啦"，最后"咔嗒"一下停住
  // 4.5 kHz 以上滤掉，所以没有真打字机那么尖
  const TW = { strike: 1400, strikeQ: 1.1, strikeTau: 0.006, body: 620, bodyTau: 0.022, ring: [2350, 3620], ringTau: 0.03, esc: 0.042, escF: 2400, bell: 1650 };
  function SoundKit(ctx) {
    const master = ctx.createGain(); master.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500; lp.Q.value = 0.5;
    master.connect(lp); lp.connect(ctx.destination);
    const nb = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.1), ctx.sampleRate);
    const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    let recent = [];
    function env(param, t, peak, tau, att = 0.001) {
      param.setValueAtTime(0, t); param.linearRampToValueAtTime(peak, t + att); param.setTargetAtTime(0, t + att, tau);
    }
    function noise(t, f, q, peak, tau) {
      const src = ctx.createBufferSource(); src.buffer = nb;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const a = ctx.createGain(); env(a.gain, t, peak, tau);
      src.connect(bp); bp.connect(a); a.connect(master); src.start(t, Math.random() * 0.04); src.stop(t + tau * 8 + 0.01);
    }
    function tone(t, f, peak, tau, att = 0.001) {
      const o = ctx.createOscillator(), a = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      env(a.gain, t, peak, tau, att); o.connect(a); a.connect(master); o.start(t); o.stop(t + tau * 8 + 0.02);
    }
    const tick = (t, g, f = TW.escF) => noise(t, f * (0.9 + Math.random() * 0.2), 1.6, 0.18 * g, 0.003);
    function strike(t, g, p) {                       // 字锤打下去
      noise(t, TW.strike * p, TW.strikeQ, 0.9 * g, TW.strikeTau);
      noise(t, TW.body * p, 2.2, 0.55 * g, TW.bodyTau);
      tone(t, TW.ring[0] * p, 0.045 * g, TW.ringTau); tone(t, TW.ring[1] * p, 0.025 * g, TW.ringTau * 0.7);
      tick(t + TW.esc * (0.85 + Math.random() * 0.3), g);
    }
    function space(t, g) { noise(t, 300, 1.5, 0.45 * g, 0.02); tick(t + 0.02, g * 1.1, 2200); }
    function back(t, g) { noise(t, 480, 1.6, 0.5 * g, 0.018); tick(t + 0.012, g, 2000); }
    function carriageReturn(t, g) {
      tone(t, TW.bell, 0.16 * g, 0.35, 0.002); tone(t, TW.bell * 2.71, 0.025 * g, 0.12, 0.002);   // 轻轻的"叮"
      let x = t + 0.16;
      for (let i = 0; i < 16; i++) { tick(x, g * (0.5 + 0.3 * Math.random()), 2400); x += 0.026 - i * 0.0009; }   // 哗啦啦（越来越快）
      noise(x + 0.01, 420, 1.4, 0.7 * g, 0.03); tick(x + 0.012, g * 1.2, 1800);                      // 咔嗒停住
    }
    return {
      play(kind, info, volume = 1) {
        const t = ctx.currentTime + 0.003;
        recent = recent.filter((x) => t - x < 0.3); recent.push(t);
        const dense = 1 / (1 + 0.1 * (recent.length - 1));
        const g = volume * dense * (0.82 + Math.random() * 0.2), p = 0.95 + Math.random() * 0.1;
        if (kind === 'type') (info.space ? space(t, g) : strike(t, g, p));
        else if (kind === 'delete') back(t, volume * 0.9);
        else if (kind === 'send') carriageReturn(t, volume);
      },
    };
  }

  root.ClaudeChanSparkTyping = { Sparks, SoundKit, TW, caretOf, tierOf, P };
})(window);
