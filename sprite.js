// Claude 娘渲染器：内置立绘（7 个状态）+ 程序动作（呼吸 / 摇晃 / 蹦跳 / 跺脚）+ 特效
// 也支持在弹窗上传自定义图覆盖任一状态
(function (root) {
  'use strict';
  const ART = root.CLAUDE_CHAN_ART;
  const REF = ART.ref;                 // 立绘里"站立高度"的像素数
  const STATES = ['idle', 'working', 'confirm', 'angry', 'done', 'drowsy', 'sleep'];
  const MAX_W = Math.max(...Object.values(ART.states).map((s) => s.w));

  // 画布（以立绘像素为单位）：左右各留 30，上方留 50 给特效，下方 8 给影子
  const PAD_X = 30, PAD_TOP = 150, PAD_BOTTOM = 8;  // 上方留空给往上飞的 token
  const UW = MAX_W + PAD_X * 2;
  const UH = REF + 10 + PAD_TOP + PAD_BOTTOM;

  const FX_PAL = { G: '#f2b84b', n: '#ffffff', K: '#5a2a18', B: '#7fc3ff', O: '#e3692c', R: '#ff5d7a' };
  const ICON = {
    sparkle: ['..G..', '..G..', 'GGnGG', '..G..', '..G..'],
    sparkleS: ['.G.', 'GnG', '.G.'],
    z: ['KKKK', '..K.', '.K..', 'KKKK'],
    drop: ['.B.', 'BnB', 'BBB', '.B.'],
    note: ['.KKK', '.K.K', '.K.K', 'KK.K', 'KKKK', 'KK..'],
    heart: ['.R.R.', 'RRRRR', 'RnRRR', '.RRR.', '..R..'],
  };

  // 5x7 像素字体（只需要 token 这几个字母）
  const GLYPH = {
    t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
    o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
    k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
    e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
    n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  };

  function dataURLToBlob(d) {
    const [head, b64] = d.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime });
  }

  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  class ClaudeChanSprite {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.art = {};       // 内置立绘 bitmap
      this.custom = {};    // 用户上传的覆盖图
      this.changedAt = 0;
      this.tokens = [];      // 往上飞的 token 粒子
      this.lastState = null;
      this.ready = this.loadArt();
      this.setHeight(170);
    }

    async loadArt() {
      for (const [k, v] of Object.entries(ART.states)) {
        try { this.art[k] = await createImageBitmap(dataURLToBlob(v.data)); } catch (e) { console.warn('[Claude娘] 立绘加载失败', k, e); }
      }
    }

    // h = 角色站立时的显示高度（CSS 像素）
    setHeight(h) {
      this.s = h / REF;
      const dpr = root.devicePixelRatio || 1;
      this.dpr = dpr;
      const cw = Math.round(UW * this.s), ch = Math.round(UH * this.s);
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
      this.canvas.style.width = cw + 'px';
      this.canvas.style.height = ch + 'px';
    }

    setCustom(map) { this.custom = map || {}; }

    // 脚底中点在画布里的位置（CSS 像素），小动画用它来对位
    foot() { return { x: (UW / 2) * this.s, y: (PAD_TOP + REF + 6) * this.s }; }
    // 黑洞特效：手心上方那个点在画布里的位置（CSS 像素）
    // 跟着她这一帧的动作（浮动 / 晃动 / 呼吸）一起走，黑洞才会一直在手心上方
    holePos() {
      const st = ART.states.blackhole, hp = ART.hole || [0, 0];
      const m = this.lastMotion || { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
      const px = -st.w / 2 + hp[0], py = -st.h + hp[1];
      const c = Math.cos(m.rot), sn = Math.sin(m.rot);
      const x = UW / 2 + m.dx + c * m.sx * px - sn * m.sy * py;
      const y = PAD_TOP + REF + 6 + m.dy + sn * m.sx * px + c * m.sy * py;
      return { x: x * this.s, y: y * this.s };
    }
    // 整个画布清空（小动画期间她"变没了"）
    blank() { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

    // 头顶留白（CSS 像素）：非工作状态时对话框可以压下来贴近头顶
    headroom() { return Math.round((PAD_TOP - 24) * this.s); }

    // 可点击/拖动的区域（只覆盖角色身体，CSS 像素）
    hitBox() {
      const s = this.s;
      const bw = MAX_W * 0.78, bh = REF * 0.96;
      return { x: Math.round((UW / 2 - bw / 2) * s), y: Math.round((PAD_TOP + REF + 6 - bh) * s), w: Math.round(bw * s), h: Math.round(bh * s) };
    }

    // 生成一个往上飞的 token（Claude 每输出一段字调用一次）
    emitToken() {
      const now = performance.now();
      if (this.lastEmit && now - this.lastEmit < 450) return;   // 别挤在一起
      this.lastEmit = now;
      this.lane = this.lane === 0 ? 1 : 0;                          // 左右交替
      if (this.tokens.length > 6) this.tokens.shift();
      this.tokens.push({ born: now, lane: this.lane, sway: Math.random() * 6.28 });
    }

    // 画像素单词：深色投影 + 橙色字身 + 顶部高光
    drawWord(word, x, y, g, alpha) {
      const { ctx } = this;
      ctx.globalAlpha = alpha;
      const paint = (col, off, topOnly) => {
        ctx.fillStyle = col;
        let cx = x;
        for (const ch of word) {
          const gl = GLYPH[ch];
          gl.forEach((row, ry) => {
            for (let rx = 0; rx < 5; rx++) {
              if (row[rx] !== '#') continue;
              if (topOnly && ry > 0 && gl[ry - 1][rx] === '#') continue;
              ctx.fillRect(cx + (rx + off) * g, y + (ry + off) * g, g, topOnly ? Math.max(1, g * 0.4) : g);
            }
          });
          cx += 6 * g;
        }
      };
      paint('#5a2a18', 1, false);
      paint('#e3692c', 0, false);
      paint('#ffb27a', 0, true);
      ctx.globalAlpha = 1;
    }

    // 每个状态的动作：返回 {dx, dy, rot, sx, sy}（dx/dy 以立绘像素为单位）
    motion(state, t, since) {
      const m = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
      const pop = ease(since / 220);              // 切换状态时的"弹出"
      const k = 0.9 + 0.1 * pop;
      m.sx = k; m.sy = k;
      switch (state) {
        case 'idle': {
          const b = Math.sin(t / 650);
          m.sy *= 1 + 0.012 * b; m.sx *= 1 - 0.006 * b;
          break;
        }
        case 'working': {
          m.dy = (Math.floor(t / 230) % 2) * -2;           // 埋头写字的小颠簸
          m.rot = Math.sin(t / 900) * 0.008;
          break;
        }
        case 'done': {
          const p = (t % 1000) / 1000;                     // 每秒蹦一下
          if (p < 0.32) m.dy = -Math.sin(p / 0.32 * Math.PI) * 18;
          else if (p < 0.42) { const q = (p - 0.32) / 0.1; m.sy *= 1 - 0.05 * Math.sin(q * Math.PI); m.sx *= 1 + 0.04 * Math.sin(q * Math.PI); }
          break;
        }
        case 'confirm': {                                  // 害羞地左右扭
          m.rot = Math.sin(t / 220) * 0.035;
          m.dy = -Math.abs(Math.sin(t / 220)) * 3;
          break;
        }
        case 'angry': {                                    // 一阵一阵地跺脚发抖
          const p = t % 1400;
          if (p < 420) { m.dx = (Math.floor(p / 45) % 2 ? 1 : -1) * 3; m.dy = p < 120 ? -6 : 0; }
          break;
        }
        case 'drowsy': {                                   // 迷迷糊糊地晃
          m.rot = Math.sin(t / 1300) * 0.045;
          m.dy = Math.max(0, Math.sin(t / 1300)) * 3;
          break;
        }
        case 'blackhole': {                                // 托着黑洞：被引力托起来一点，慢慢上下浮 + 呼吸 + 轻轻晃
          const f = Math.sin(t / 2600 * Math.PI * 2);
          m.dy = -7 - 5 * f;
          m.rot = Math.sin(t / 1700) * 0.014;
          const b = Math.sin(t / 650);
          m.sy *= 1 + 0.012 * b; m.sx *= 1 - 0.006 * b;
          break;
        }
        case 'sleep': {
          const b = Math.sin(t / 1100);
          m.sy *= 1 + 0.02 * b; m.sx *= 1 - 0.008 * b;
          break;
        }
      }
      return m;
    }

    // fx: 覆盖默认特效（戳一戳的反应用）
    render(state, t, fx) {
      const { ctx, s, dpr } = this;
      if (state !== this.lastState) { this.lastState = state; this.changedAt = t; }
      const since = t - this.changedAt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const u = s * dpr; // 立绘像素 → 设备像素
      ctx.setTransform(u, 0, 0, u, 0, 0);

      const cust = this.custom[state];
      const img = (cust && cust.bitmap) || this.art[state] || this.art.idle;
      if (!img) return;
      const m = this.motion(state, t, since);
      this.lastMotion = m;

      // 底部中心作为锚点
      const footX = UW / 2, footY = PAD_TOP + REF + 6;
      let w, h, fw, sxOff = 0;
      if (cust && cust.bitmap) {
        const frames = Math.max(1, cust.frames | 0);
        const idx = frames > 1 ? Math.floor(t / (1000 / (cust.fps || 6))) % frames : 0;
        fw = cust.bitmap.width / frames;
        const k = Math.min(REF / cust.bitmap.height, (MAX_W * 1.1) / fw);
        w = fw * k; h = cust.bitmap.height * k; sxOff = idx * fw;
      } else {
        w = img.width; h = img.height; fw = img.width;
      }

      // 影子（跳起来时变小）
      const lift = Math.max(0, -m.dy);
      ctx.fillStyle = 'rgba(60,30,15,0.16)';
      const shw = (w * 0.62) * (1 - lift / 60);
      ctx.beginPath();
      ctx.ellipse(footX, footY - 2, shw / 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(footX + m.dx, footY + m.dy);
      ctx.rotate(m.rot);
      ctx.scale(m.sx, m.sy);
      ctx.imageSmoothingEnabled = s * dpr < 1;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sxOff, 0, fw, img.height, -w / 2, -h, w, h);
      ctx.restore();

      this.drawFx(fx || state, t, { x: footX - w / 2 + m.dx, y: footY - h + m.dy, w, h }, since);
    }

    stamp(rows, x, y, k) {
      const { ctx } = this;
      rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          const c = row[dx];
          if (c === '.') continue;
          ctx.fillStyle = FX_PAL[c] || c;
          ctx.fillRect(x + dx * k, y + dy * k, k, k);
        }
      });
    }

    // 立绘里已经画了感叹线 / 怒气符号 / 泡泡，这里只补一点会动的特效
    drawFx(state, t, r, since = 0) {
      const k = 4; // 特效像素格大小（立绘像素）
      if (state === 'heart') {                       // 开心：小爱心往上飘
        for (let i = 0; i < 3; i++) {
          const p = ((since + i * 380) % 1300) / 1300;
          const x = [r.x - 14, r.x + r.w * 0.45, r.x + r.w + 2][i] + Math.sin(p * 6 + i) * 6;
          const y0 = [r.y + 70, r.y - 10, r.y + 50][i];
          if (p < 0.85) this.stamp(ICON.heart, x, y0 - p * 60, k + 1 + (i === 1 ? 1 : 0));
        }
        return;
      }
      if (state === 'drop') {                        // 害羞：一滴汗
        this.stamp(ICON.drop, r.x + r.w * 0.8, r.y + 70 + Math.min(since, 900) / 40, k);
        return;
      }
      if (state === 'angry') return;                 // 生气立绘自带怒气符号
      if (state === 'done') {
        const ph = Math.floor(t / 260) % 2;
        const spots = [[r.x - 18, r.y + 60], [r.x + r.w - 4, r.y + 20], [r.x - 10, r.y + 200], [r.x + r.w + 2, r.y + 170], [r.x + r.w * 0.55, r.y - 26]];
        spots.forEach((p, i) => { if ((i + ph) % 2 === 0) this.stamp(i % 2 ? ICON.sparkle : ICON.sparkleS, p[0], p[1], k); });
      } else if (state === 'sleep') {
        const n = Math.floor(t / 650) % 3;
        for (let i = 0; i <= n; i++) this.stamp(ICON.z, r.x + r.w * 0.86 + i * 18, r.y + 4 - i * 26, k + 1 + i);
      } else if (state === 'confirm') {
        if (Math.floor(t / 900) % 2) this.stamp(ICON.drop, r.x + r.w * 0.8, r.y + 70 + (t % 900) / 40, k);
      } else if (state === 'working') {
        // 像素字 token 从书本处往上飞、渐隐 —— 就是在消耗 token 呀
        const g = Math.max(4, Math.ceil(2.2 / this.s));   // 字的像素格：屏幕上至少 ~2.2px，整个单词约 15px 高
        const wordW = 29 * g, LIFE = 1600;
        const now = performance.now();
        this.tokens = this.tokens.filter((tk) => now - tk.born < LIFE);
        for (const tk of this.tokens) {
          const p = (now - tk.born) / LIFE;
          const x = r.x + r.w / 2 + (tk.lane ? 34 : -34) - wordW / 2 + Math.sin(p * 4 + tk.sway) * 5;   // 左右交替成之字
          const y = r.y + 30 - ease(p) * 175;            // 从头顶往上飞，不挡脸
          const alpha = p < 0.1 ? p / 0.1 : p > 0.6 ? Math.max(0, 1 - (p - 0.6) / 0.4) : 1;
          this.drawWord('token', Math.round(x), Math.round(y), g, alpha);
        }
      }
    }
  }

  root.ClaudeChanSprite = ClaudeChanSprite;
  root.ClaudeChanSprite.STATES = STATES;
})(window);
