// Claude 娘 2 号小动画：嘭一声变成 Claude 向日葵 → 使劲挣 → 花瓣迸开、翻成书页绕着转
// → 书页冲回中间叠成一摞 → 书壳甩进来夹住 → 光点被吸进书里、越来越亮 → 嘭，变回来
(function (root) {
  'use strict';
  const ART = root.ClaudeChanAnimArt;
  const L = ART.logo, MT = ART.meta;
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  // 每片花瓣是一个边数很少的凸多边形（坐标以 logo 中心为原点）；12 片合在一起就是完整的向日葵
  const RAYS = L.polys.map((p) => {
    const n = p.pts.length;
    const c = p.pts.reduce((s, q) => [s[0] + q[0] / n, s[1] + q[1] / n], [0, 0]);
    return { ang: p.ang, pts: p.pts, c };
  });
  function petalPath(ctx, r, ox = 0, oy = 0) {
    ctx.beginPath();
    r.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - ox, y - oy) : ctx.moveTo(x - ox, y - oy)));
    ctx.closePath(); ctx.fill();
  }
  const COVER = load(ART.book.cover), PAGES = load(ART.book.pages);
  const SHEETS = ART.sheets.map(load);

  // ---------------------------------------------------------------- 尺寸（CSS 像素）
  const W = 840, H = 400, FOOT = [420, 382];
  const LK = 132 / L.size[0];                 // logo 显示大小：直径约 132px
  const CELL = 4, SP = 2, BOOK_W = 28 * CELL, BOOK_H = 34 * CELL;

  // ---------------------------------------------------------------- 时间轴（秒）
  const T_APPEAR = 0.05;
  const PULLS = [1.0, 1.55, 2.1];             // 三次使劲往外挣
  const T_BREAK = 2.65;                       // 迸开
  const OUT = 0.5, MORPH0 = 0.18, MORPH = 0.36; // 花瓣飞出去，途中翻成书页
  const T_GATHER = 3.85, FLY = 0.45;          // 书页一起冲回中间
  const T_STACK = T_GATHER + FLY;             // 砰：叠成一摞
  const T_SHELL = T_STACK + 0.3, SHELL_FLY = 0.36;
  const T_FORM = T_SHELL + SHELL_FLY;         // 啪：夹住，变成书
  const T_P0 = T_FORM + 0.15, T_P1 = T_FORM + 1.75;   // 光点从四周旋转着被吸进书里（和视频里一样：越往后越密）
  const T_GLOW = T_FORM + 1.9;                // 吸得差不多了：书开始发白光、颤
  const T_POOF2 = T_FORM + 2.75;              // 嘭，她在书的位置出现
  const T_MOVE = T_POOF2 + 0.85, MOVE = 0.6;  // 站稳了，再蹦回原来的位置
  const DUR = T_MOVE + MOVE + 0.25;
  const HIDE_HER = [0.06, T_POOF2 + 0.08];
  const SHIFT = 62, RISE = 26;                // 书相对她原位往屏幕里侧挪、往上浮的距离

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
  const easeIO = (u) => { u = clamp(u); return u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2; };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
  const easeIn = (u) => Math.pow(clamp(u), 2.4);
  const backOut = (u) => { u = clamp(u); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const PUFFS = Array.from({ length: 11 }, () => [rnd() * Math.PI * 2, 20 + rnd() * 34, 10 + rnd() * 9]);
  const PETALS = RAYS.map((r, i) => ({
    a: r.ang * Math.PI / 180, dist: 104 + rnd() * 30, spin: (rnd() < 0.5 ? -1 : 1) * (200 + rnd() * 260),
    sheet: i % SHEETS.length, tilt: (rnd() - 0.5) * 40, ph: rnd() * 6.28, wob: rnd() * 6.28,
    cx: r.c[0], cy: r.c[1],
  }));
  const CLAUDE = ['#d97757', '#e3692c', '#c4562a', '#ffb27a', '#f3d08a', '#ffeccd'];
  const NP = 150;
  const PARTS = Array.from({ length: NP }, () => ({
    t0: T_P0 + (T_P1 - T_P0) * Math.sqrt(rnd()), dur: 0.75 + rnd() * 0.4,
    a: rnd() * Math.PI * 2, r0: 150 + rnd() * 140, spin: (rnd() < 0.5 ? -1 : 1) * (1.6 + rnd() * 1.2),
    col: CLAUDE[Math.floor(rnd() * CLAUDE.length)], sz: rnd() < 0.75 ? 2 : 3,
  })).sort((a, b) => a.t0 + a.dur - b.t0 - b.dur);
  const TRAIL = [[0, 1], [0.022, 0.78], [0.044, 0.59], [0.066, 0.41], [0.088, 0.27], [0.11, 0.16]];   // 长拖尾 = 流光
  const PP = 2;                                // 粒子画在 1/2 大小的画布上，保持像素感
  const plow = document.createElement('canvas'); plow.width = W / PP; plow.height = H / PP;
  const pctx = plow.getContext('2d');
  const bookCv = document.createElement('canvas'); bookCv.width = BOOK_W + 8; bookCv.height = BOOK_H + 8;
  const bctx = bookCv.getContext('2d');

  // ---------------------------------------------------------------- 嘭：像素烟雾
  const PX = 3;
  const low = document.createElement('canvas'); low.width = W / PX; low.height = H / PX;
  const lctx = low.getContext('2d');
  function smoke(ctx, u, cx, cy, big = 1) {
    if (u < 0 || u > 0.8) return;
    lctx.clearRect(0, 0, low.width, low.height);
    const items = [[cx, cy, 36 * big * easeOut(u / 0.15) * (1 - smooth((u - 0.2) / 0.5))]];
    for (const [a, dist, r] of PUFFS) {
      const e = easeOut(u / 0.4);
      items.push([cx + Math.cos(a) * dist * big * e, cy + Math.sin(a) * dist * big * e * 0.8 - 10 * u, r * big * (0.5 + 0.5 * e) * (1 - smooth((u - 0.25) / 0.5))]);
    }
    const circ = (x, y, r, col) => { lctx.fillStyle = col; lctx.beginPath(); lctx.arc(x / PX, y / PX, r / PX, 0, Math.PI * 2); lctx.fill(); };
    for (const [x, y, r] of items) if (r > 1.5) circ(x + r * 0.18, y + r * 0.22, r, '#e8bca0');
    for (const [x, y, r] of items) if (r > 1.5) circ(x, y, r, '#fff2e4');
    const al = 1 - clamp((u - 0.3) / 0.4);
    if (al > 0) {
      lctx.fillStyle = `rgba(243,208,138,${al})`;
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + 0.4, dist = 72 * big * easeOut(u / 0.5);
        const x = Math.round((cx + Math.cos(a) * dist) / PX), y = Math.round((cy + Math.sin(a) * dist) / PX);
        lctx.fillRect(x - 1, y, 3, 1); lctx.fillRect(x, y - 1, 1, 3);
      }
    }
    ctx.drawImage(low, 0, 0, W, H);
  }

  // 合上的书（和 1 号动画同一套像素图）
  function closedBook(ctx, x, y, cover = true, pages = true) {
    const ox = Math.round(x - BOOK_W / 2), top = Math.round(y - BOOK_H / 2);
    if (pages) ctx.drawImage(PAGES, ox, top, BOOK_W, BOOK_H);
    if (cover) {
      ctx.drawImage(COVER, ox, top, BOOK_W, BOOK_H);                // 整张封面一次画完，书脊和封面之间不留缝
    }
  }

  // ---------------------------------------------------------------- 一帧
  // dir：-1 往左边展开（她在屏幕右边时），+1 往右边展开
  function draw(ctx, t, dir = -1) {
    ctx.clearRect(0, 0, W, H);
    const bodyY = FOOT[1] - 80;
    const up = easeIO((t - T_APPEAR) / 0.6);
    const cx = FOOT[0] + dir * SHIFT * up;                     // 浮起来时往屏幕里侧挪，绕圈的书页不出屏
    const cy = bodyY - RISE * up + 3 * Math.sin(t * 3.6) * smooth((t - 0.4) / 0.3) * (1 - smooth((t - T_GLOW) / 0.3));

    // ---------- 1. 向日葵：出现 → 呼吸 → 三次使劲挣
    if (t >= T_APPEAR && t < T_BREAK + 0.04) {
      const pop = 0.45 + 0.55 * backOut((t - T_APPEAR) / 0.34);
      let squeeze = 0, stretch = 0;
      PULLS.forEach((tp, i) => {
        const u = t - tp;
        if (u > -0.12 && u < 0.45) {
          const k = 0.6 + 0.25 * i;
          squeeze = Math.max(squeeze, k * Math.exp(-(((u + 0.04) / 0.07) ** 2)));     // 先缩一下
          stretch = Math.max(stretch, k * (u > 0 ? Math.sin(Math.PI * clamp(u / 0.4)) : 0));   // 再往外挣
        }
      });
      const pre = smooth((t - (T_BREAK - 0.35)) / 0.35);             // 迸开前最后一下，绷到最紧
      const trem = t < PULLS[0] - 0.3 ? 0 : (0.6 + 2.2 * clamp((t - PULLS[0]) / (T_BREAK - PULLS[0]))) ;
      const sc = pop * (1 - 0.08 * squeeze + 0.05 * pre) * LK;
      const rot = 0.25 * Math.sin(t * 1.3) * (1 - smooth((t - PULLS[0] + 0.3) / 0.3)) + 0.02 * trem * Math.sin(t * 70);
      const sx = trem * Math.sin(t * 83), sy = trem * Math.cos(t * 71);
      ctx.save();
      ctx.translate(cx + sx, cy + sy); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.globalAlpha = clamp((t - T_APPEAR) / 0.08);
      ctx.fillStyle = L.color;
      RAYS.forEach((r, i) => {
        const p = PETALS[i];
        const out = (20 * stretch + 26 * pre) * (0.75 + 0.5 * Math.sin(p.wob + t * 9));           // 每瓣往外挣的幅度不一样
        const wig = (0.12 * stretch + 0.12 * pre) * Math.sin(t * 23 + p.wob);
        ctx.save();
        ctx.translate(Math.cos(p.a) * out, Math.sin(p.a) * out);
        ctx.rotate(wig);
        petalPath(ctx, r);
        ctx.restore();
      });
      ctx.restore();
    }

    // ---------- 2. 迸开：花瓣往外飞，途中翻成书页；之后书页绕着中心转
    if (t >= T_BREAK && t < T_STACK) {
      const u = t - T_BREAK;
      // 中心一闪
      if (u < 0.3) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
        const k = 1 - u / 0.3;
        g.addColorStop(0, `rgba(255,245,225,${0.95 * k})`); g.addColorStop(1, 'rgba(255,230,200,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - 80, cy - 80, 160, 160);
      }
      const om = 1.1 * smooth(u / 0.6);                                  // 绕圈角速度慢慢起来
      const gv = (t - T_GATHER) / FLY;                                    // 冲回中间
      PETALS.forEach((p, i) => {
        const r = RAYS[i];
        const e = easeOut(u / OUT);
        const ang = p.a + om * Math.max(0, u - 0.25) * (dir < 0 ? -1 : 1);
        const rad = (Math.hypot(p.cx, p.cy) * LK) + (p.dist - Math.hypot(p.cx, p.cy) * LK) * e;
        let x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * 0.78 + 4 * Math.sin(t * 3 + p.ph);
        let rotDeg = p.spin * e * 0.5 + p.tilt * smooth((u - OUT) / 0.4) + 6 * Math.sin(t * 4 + p.ph);
        let sc = 1;
        if (gv > 0) {                                                     // 加速冲回中间，越来越小
          const g = easeIn(gv);
          x += (cx - x) * g; y += (cy - y) * g; rotDeg *= 1 - g; sc = 1 - 0.35 * g;
        }
        const m = clamp((u - MORPH0) / MORPH);                            // 0 花瓣 → 1 书页（中间像纸翻面一样）
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.rotate(rotDeg * Math.PI / 180);
        if (m < 0.5) {
          const fx = 1 - 2 * m;
          ctx.scale(LK * Math.max(0.02, fx), LK);
          ctx.fillStyle = L.color;
          petalPath(ctx, r, r.c[0], r.c[1]);
        } else {
          const fx = 2 * m - 1, s = 0.62 * sc;
          ctx.imageSmoothingEnabled = false;
          ctx.scale(s * Math.max(0.02, fx) * (0.85 + 0.15 * Math.cos(t * 6 + p.ph)), s);
          ctx.drawImage(SHEETS[p.sheet], -16 * SP, -19.5 * SP, 32 * SP, 39 * SP);
          ctx.imageSmoothingEnabled = true;
        }
        ctx.restore();
      });
    }

    // ---------- 3. 叠成一摞 → 书壳甩进来夹住 → 书；光点从四周旋转着被吸进去，书越来越白、越来越亮
    ctx.imageSmoothingEnabled = false;
    const arrived = (tt) => { let n = 0; for (const p of PARTS) if (p.t0 + p.dur <= tt) n++; else break; return n; };
    const absorbed = arrived(t) / NP;
    const glowU = clamp((t - T_GLOW) / (T_POOF2 - T_GLOW));
    // 天色暗下来一点，把光点衬出来（嘭之后慢慢亮回来）
    const dim = t < T_POOF2 ? 0.32 * smooth((t - T_P0) / (T_GLOW - T_P0)) : 0.32 * (1 - smooth((t - T_POOF2 - 0.2) / 0.8));
    if (dim > 0.005) {
      const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 300);
      g.addColorStop(0, `rgba(70,45,40,${dim})`); g.addColorStop(0.6, `rgba(70,45,40,${dim * 0.6})`); g.addColorStop(1, 'rgba(70,45,40,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (t >= T_STACK && t < T_POOF2 + 0.04) {
      const us = t - T_STACK, uf = t - T_FORM;
      let sqx = 1, sqy = 1;
      if (us < 0.25) { const k = Math.exp(-us / 0.06); sqx = 1 + 0.12 * k; sqy = 1 - 0.12 * k; }   // 砰：一压
      if (uf > 0 && uf < 0.25) { const k = Math.exp(-uf / 0.06); sqx = 1 + 0.1 * k; sqy = 1 - 0.1 * k; }
      // 背后：暖光 + 一圈转动的像素光芒
      if (t > T_FORM) {
        const gk = 0.45 * absorbed + 0.75 * easeIn(glowU);
        const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 120 + 40 * gk);
        g.addColorStop(0, `rgba(255,214,150,${0.55 * gk})`); g.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - 170, cy - 170, 340, 340);
        const ra = clamp((t - (T_GLOW - 0.4)) / (T_POOF2 - T_GLOW + 0.4));
        if (ra > 0) {
          pctx.clearRect(0, 0, plow.width, plow.height);
          const lx = cx / PP, ly = cy / PP;
          for (let k = 0; k < 12; k++) {
            const a = k * Math.PI / 6 + t * 0.9, Lr = (48 + 24 * (k % 2)) * (0.6 + 0.4 * ra), wd = 0.05 + 0.03 * (k % 2);
            pctx.fillStyle = `rgba(255,214,150,${0.45 * smooth(ra)})`;
            pctx.beginPath(); pctx.moveTo(lx, ly);
            pctx.lineTo(lx + Lr * Math.cos(a - wd), ly + Lr * Math.sin(a - wd)); pctx.lineTo(lx + Lr * Math.cos(a + wd), ly + Lr * Math.sin(a + wd)); pctx.fill();
          }
          ctx.drawImage(plow, 0, 0, W, H);
        }
      }
      // 书本身：越来越白；每吸进一颗光点闪一下；快嘭的时候变大、发颤
      bctx.clearRect(0, 0, bookCv.width, bookCv.height);
      bctx.imageSmoothingEnabled = false;
      closedBook(bctx, bookCv.width / 2, bookCv.height / 2, t >= T_FORM, true);
      let white = t > T_FORM ? 0.85 * easeIn(clamp((t - (T_GLOW - 0.6)) / (T_POOF2 - T_GLOW + 0.6))) : 0;
      if (t > T_FORM) white = Math.min(0.92, white + Math.min(0.16, 0.025 * (arrived(t) - arrived(t - 0.08))));
      if (white > 0) {
        bctx.globalCompositeOperation = 'source-atop';
        bctx.fillStyle = `rgba(255,246,228,${white})`; bctx.fillRect(0, 0, bookCv.width, bookCv.height);
        bctx.globalCompositeOperation = 'source-over';
      }
      const grow = 1 + 0.12 * easeIn(glowU), jit = (2 + 3 * glowU) * glowU;
      const tilt = t > T_FORM ? 0.05 * Math.sin(2 * Math.PI * t / 3.1) : 0;
      ctx.save();
      ctx.translate(cx + jit * Math.sin(t * 97), cy + BOOK_H / 2 + jit * Math.cos(t * 83));
      ctx.scale(sqx * grow, sqy * grow); ctx.rotate(tilt);
      ctx.drawImage(bookCv, -bookCv.width / 2, -BOOK_H / 2 - bookCv.height / 2);
      ctx.restore();
      // 书壳从里侧甩进来
      if (t >= T_SHELL && t < T_FORM) {
        const v = easeIn((t - T_SHELL) / SHELL_FLY);
        const sx = cx + dir * (220 * (1 - v)), sy = cy - 70 * (1 - v) * (1 - v);
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(dir * -0.9 * (1 - v));
        closedBook(ctx, 0, 0, true, false);
        ctx.restore();
      }
    }
    // 光点（带长拖尾）
    if (t > T_P0 && t < T_POOF2 + 0.2) {
      pctx.clearRect(0, 0, plow.width, plow.height);
      for (const p of PARTS) {
        for (const [lag, al] of TRAIL) {
          const u = (t - lag - p.t0) / p.dur;
          if (u < 0 || u > 1) continue;
          const e = easeIn(u), r = p.r0 * (1 - e), a = p.a + p.spin * e;
          const sz = lag === 0 ? p.sz : Math.max(1, p.sz - 1);
          pctx.globalAlpha = al * clamp(u / 0.12);
          pctx.fillStyle = p.col;
          pctx.fillRect(Math.round((cx + r * Math.cos(a)) / PP), Math.round((cy + r * Math.sin(a) * 0.72) / PP), sz, sz);
        }
      }
      pctx.globalAlpha = 1;
      ctx.drawImage(plow, 0, 0, W, H);
    }
    // 嘭之前一道白光
    const fl = (t - T_POOF2 + 0.12) / 0.3;
    if (fl > 0 && fl < 1) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 + 120 * fl);
      g.addColorStop(0, `rgba(255,252,240,${Math.sin(Math.PI * fl)})`); g.addColorStop(1, 'rgba(255,240,215,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 170, cy - 170, 340, 340);
    }
    ctx.imageSmoothingEnabled = true;
    smoke(ctx, t, FOOT[0], bodyY);                                       // 嘭：变成向日葵
    smoke(ctx, t - T_POOF2, cx, cy, 1.25);                              // 嘭：在书的位置变回来
  }

  // 她本人相对原位的偏移（CSS 像素，按 170px 高算）：嘭出来时在书的位置，站稳后蹦回去
  function herOffset(t, dir = -1) {
    if (t < T_POOF2) return [0, 0];
    const u = easeIO((t - T_MOVE) / MOVE);
    const hop = 14 * Math.sin(Math.PI * clamp((t - T_MOVE) / MOVE));
    return [dir * SHIFT * (1 - u), -RISE * (1 - u) - hop];
  }

  root.ClaudeChanAnims = Object.assign(root.ClaudeChanAnims || {}, {
    logo: { name: '向日葵', duration: DUR, size: [W, H], foot: FOOT, hideHer: HIDE_HER, draw, herOffset,
            times: { T_APPEAR, PULLS, T_BREAK, T_GATHER, T_STACK, T_SHELL, T_FORM, T_P0, T_P1, T_GLOW, T_POOF2, T_MOVE, MOVE, DUR, PARTS: PARTS.map((p) => p.t0 + p.dur) },
            ready: () => Promise.all([COVER, PAGES, ...SHEETS].map((im) => im.decode().catch(() => {}))) },
  });
})(typeof window !== 'undefined' ? window : globalThis);
