// Claude 娘 1 号小动画：嘭一声变成书 → 书打开 → 书页像花瓣一样飞出来 → 合上 → 嘭，变回来
// 全部用代码实时画（只带几 KB 的像素图），60 帧也不卡。
(function (root) {
  'use strict';
  const ART = root.ClaudeChanAnimArt;
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const IMG = {};
  for (const [k, v] of Object.entries(ART.book)) IMG[k] = load(v);
  const SHEETS = ART.sheets.map(load);
  const MT = ART.meta;

  // ---------------------------------------------------------------- 尺寸（CSS 像素）
  const W = 840, H = 400;            // 动画画布（左右留足地方给被风吹走的书页）
  const FOOT = [420, 382];           // 她脚底中点在画布里的位置
  const CELL = 4;                    // 书的一个像素格 = 4px
  const SP = 2;                      // 飞出来的书页：一个像素 = 2px
  const BOOK_W = 28 * CELL, BOOK_H = 34 * CELL;

  // ---------------------------------------------------------------- 时间轴（秒）
  const T_POOF1 = 0.0, T_APPEAR = 0.05;
  const T_OPEN0 = 0.62, OPEN = 0.5;
  const T_BURST = 1.12, BURST_SPREAD = 0.75, PFLY = 0.42;   // 书页一张张喷出来，盖满书的区域
  const T_FULL = T_BURST + BURST_SPREAD + PFLY;             // 全盖住了：书在后面悄悄消失，她在后面悄悄回来
  const T_WIND = T_FULL + 0.3, WIND = 1.25;                  // 一阵风把书页吹走，露出她
  const DUR = T_WIND + WIND + 0.25;
  const HIDE_HER = [0.06, T_FULL + 0.02];
  const SLOW = 1.4;                                         // 整体放慢：上面的时间都按这个倍数拉长

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
  const easeIO = (u) => { u = clamp(u); return u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2; };
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
  const backOut = (u) => { u = clamp(u); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

  // 固定的随机数（每次播放都一样，方便调）
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const PUFFS = Array.from({ length: 11 }, () => [rnd() * Math.PI * 2, 20 + rnd() * 34, 10 + rnd() * 9]);
  // 要盖住的区域（相对她脚底，dir=-1 时）：翻开的书往里侧挪了 46px、往上浮了 34px，再加上她本人
  const COVER_BOX = [-150, -200, 72, 6];                    // x0, y0, x1, y1
  const PAGES = [];
  {
    const [x0, y0, x1, y1] = COVER_BOX, cols = 6, rows = 6;
    const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      PAGES.push({ tx: x0 + cw * (c + 0.5) + (rnd() - 0.5) * cw * 0.5, ty: y0 + ch * (r + 0.5) + (rnd() - 0.5) * ch * 0.5,
                   ta: (rnd() - 0.5) * 40, sc: 0.72 + rnd() * 0.12, sheet: Math.floor(rnd() * SHEETS.length), side: rnd() < 0.5 ? 0 : 1,
                   o: rnd(), spin: (rnd() - 0.5) * 2, lift: 0.4 + rnd() * 0.8, ph: rnd() * 6.28 });
    }
    PAGES.sort((a, b) => a.o - b.o);                         // 喷出顺序打乱，看起来是乱飞着堆起来的
  }
  const N = PAGES.length;

  // ---------------------------------------------------------------- 书：合上 → 翻开（和视频里同一套像素图）
  // theta：0 合上 → π 翻开到中间页；画在 (hingeX, top) 为装订轴的位置
  function drawBook(ctx, theta, hingeX, top, alpha) {
    const c = Math.cos(theta);
    const H0 = MT.H0 * CELL, SY = MT.SIDE_Y * CELL;
    const ox = hingeX - H0;
    ctx.save(); ctx.globalAlpha = alpha;
    const kb = clamp((1 - c) / 0.4);
    if (kb > 0) { ctx.globalAlpha = alpha * kb; ctx.drawImage(IMG.sideR, hingeX, top + SY, 23 * CELL, 33 * CELL); ctx.globalAlpha = alpha; }
    ctx.drawImage(IMG.pages, ox, top, BOOK_W, BOOK_H);
    if (c > 0.005) {
      ctx.globalAlpha = alpha * c;
      ctx.drawImage(IMG.cover, 0, 0, MT.H0 + 1, 34, ox, top, (MT.H0 + 1) * CELL, BOOK_H);      // 书脊：多画一列压到封面底下，缩放时也不会露缝
      ctx.globalAlpha = alpha;
      const fw = Math.max(1, Math.round((28 - MT.H0) * CELL * c));
      if (c < 0.999) ctx.filter = `brightness(${0.7 + 0.3 * c})`;
      ctx.drawImage(IMG.cover, MT.H0, 0, 28 - MT.H0, 34, hingeX, top, fw, BOOK_H);                // 封面以装订轴为轴翻起
      ctx.filter = 'none';
    } else if (c < -0.005) {
      const fw = Math.max(1, Math.round(23 * CELL * -c));
      if (c > -0.999) ctx.filter = `brightness(${0.8 + 0.2 * -c})`;
      ctx.drawImage(IMG.sideL, hingeX - fw, top + SY, fw, 33 * CELL);                              // 翻过去落在左边
      ctx.filter = 'none';
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 嘭：像素烟雾（先画在 1/3 大小的小画布上再放大，保持像素感）
  const PX = 3;
  const low = document.createElement('canvas'); low.width = W / PX; low.height = H / PX;
  const lctx = low.getContext('2d');
  function smoke(ctx, u, cx, cy) {
    if (u < 0 || u > 0.75) return;
    lctx.clearRect(0, 0, low.width, low.height);
    const items = [[cx, cy, 34 * easeOut(u / 0.15) * (1 - smooth((u - 0.2) / 0.5))]];
    for (const [a, dist, r] of PUFFS) {
      const e = easeOut(u / 0.4);
      items.push([cx + Math.cos(a) * dist * e, cy + Math.sin(a) * dist * e * 0.8 - 10 * u, r * (0.5 + 0.5 * e) * (1 - smooth((u - 0.25) / 0.5))]);
    }
    const circ = (x, y, r, col) => { lctx.fillStyle = col; lctx.beginPath(); lctx.arc(x / PX, y / PX, r / PX, 0, Math.PI * 2); lctx.fill(); };
    for (const [x, y, r] of items) if (r > 1.5) circ(x + r * 0.18, y + r * 0.22, r, '#e8bca0');
    for (const [x, y, r] of items) if (r > 1.5) circ(x, y, r, '#fff2e4');
    const al = 1 - clamp((u - 0.3) / 0.4);
    if (al > 0) {                                                  // 几颗星星碎屑
      lctx.fillStyle = `rgba(243,208,138,${al})`;
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + 0.4, dist = 70 * easeOut(u / 0.5);
        const x = Math.round((cx + Math.cos(a) * dist) / PX), y = Math.round((cy + Math.sin(a) * dist) / PX);
        lctx.fillRect(x - 1, y, 3, 1); lctx.fillRect(x, y - 1, 1, 3);
      }
    }
    ctx.drawImage(low, 0, 0, W, H);
  }

  // ---------------------------------------------------------------- 一帧
  // 风：几道像素风线横扫过去
  function windLines(ctx, t, dir, cx, cy) {
    const u = (t - T_WIND + 0.08) / 0.7;
    if (u < 0 || u > 1) return;
    ctx.save();
    for (let k = 0; k < 7; k++) {
      const v = u * 1.5 - k * 0.07;
      if (v < 0 || v > 1) continue;
      const len = 40 + (k * 37) % 50, y = cy - 150 + k * 27 + 6 * Math.sin(k * 2.1);
      const x = cx - dir * 230 + dir * 520 * v;               // 从里侧吹向外侧（和书页飞走的方向一样）
      ctx.globalAlpha = 0.75 * Math.sin(Math.PI * v);
      ctx.fillStyle = k % 2 ? '#c9d6e2' : '#dfe8f0';                  // 淡淡的蓝灰色，白底网页上也看得见
      ctx.fillRect(Math.round(x - (dir < 0 ? 0 : len)), Math.round(y), len, 3);
      ctx.fillRect(Math.round(x - (dir < 0 ? -len - 8 : len + 18)), Math.round(y + 6), Math.round(len * 0.4), 2);
    }
    ctx.restore();
  }

  // dir：-1 往左边展开（她在屏幕右边时），+1 往右边展开（她在屏幕左边时）
  function draw(ctx, t, dir = -1) {
    t /= SLOW;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const bodyY = FOOT[1] - 80;
    const up = easeIO((t - T_APPEAR) / 0.55);
    const bob = 3 * Math.sin((t - T_APPEAR) * 4.2) * smooth((t - 0.4) / 0.3);
    const cy = bodyY - 34 * up + bob;
    const cx = FOOT[0] + dir * 46 * up;
    const sc = 0.45 + 0.55 * backOut((t - T_APPEAR) / 0.32);
    const alpha = clamp((t - T_APPEAR) / 0.08) * (t < T_FULL ? 1 : 0);   // 盖满以后书就不画了
    const theta = Math.PI * easeIO((t - T_OPEN0) / OPEN);
    const kk = (1 - Math.cos(theta)) / 2;
    if (kk > 0.05 && alpha > 0) {                                     // 翻开时书页里透出暖光
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 120);
      g.addColorStop(0, `rgba(255,200,130,${0.55 * clamp((kk - 0.05) / 0.6)})`); g.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 130, cy - 130, 260, 260);
    }
    if (alpha > 0 && t >= T_APPEAR) {
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
      const hx = Math.round(cx - (BOOK_W / 2 - MT.H0 * CELL) * (1 - kk));   // 合上时书居中；翻开后装订轴居中
      drawBook(ctx, theta, hx, Math.round(cy - BOOK_H / 2), alpha);
      ctx.restore();
    }
    // 书页：从左右两页上揭起来 → 飞到各自的位置，一张压一张把整片区域盖满 → 风来了，从里侧到外侧依次被吹走
    const pageTop = cy - BOOK_H / 2 + MT.SIDE_Y * CELL + CELL;
    const PW = MT.RPAGE[0] * CELL, PH = MT.RPAGE[1] * CELL;
    PAGES.forEach((p, k) => {
      const t0 = T_BURST + BURST_SPREAD * k / (N - 1);
      const v = (t - t0) / PFLY;
      if (v <= 0) return;
      const im = SHEETS[p.sheet];
      const sd = dir < 0 ? p.side : 1 - p.side;
      const sx = sd ? cx + PW * 0.5 : cx - PW * 0.5, sy = pageTop + PH * 0.5;
      const TX = FOOT[0] + (dir < 0 ? p.tx : -p.tx), ty = FOOT[1] + p.ty;
      const lift = clamp(v / 0.2), e = easeOut((v - 0.1) / 0.9);
      const g0 = PW / (32 * SP);
      let g = g0 * (1 + 0.08 * Math.sin(Math.PI * lift)) * (1 - e) + p.sc * e;
      let x = sx + (TX - sx) * e, y = sy + (ty - sy) * e - 26 * Math.sin(Math.PI * e);
      let a = (p.ta * e + (sd ? 18 : -18) * Math.sin(Math.PI * e)) * (dir < 0 ? 1 : -1);
      let fade = 1, flip = 1;
      if (t < T_WIND) {                                            // 堆着的时候纸边轻轻颤
        a += 1.2 * Math.sin(t * 9 + p.ph) * clamp((t - T_FULL + 0.3) / 0.3);
      } else {
        // 风从屏幕边那一侧吹过来，往屏幕里侧吹：靠外侧的先被吹起
        const outer = clamp(((TX - FOOT[0]) * -dir + 150) / 222);     // 0 里侧 → 1 外侧
        const w = t - T_WIND - 0.3 * (1 - outer) - 0.08 * p.o;
        if (w > 0) {
          const spd = 0.7 + 0.6 * (p.ph / 6.28);                         // 每张纸被吹得快慢不一样，散开来
          const push = (620 * w * w + 90 * w) * spd;
          x += dir * push;
          y += (0.7 - p.lift) * 460 * w * w - 60 * w + 14 * Math.sin(w * 9 + p.ph);      // 有的往上卷，有的往下落
          a += (dir < 0 ? -1 : 1) * (60 + 90 * p.spin) * w * w + 8 * Math.sin(w * 11 + p.ph);
          flip = 0.78 + 0.22 * Math.cos(w * 10 + p.ph);
          fade = 1 - smooth((push - 130) / 190);                        // 飞出画布之前就淡掉
        }
      }
      if (fade <= 0) return;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a * Math.PI / 180);
      ctx.scale(g * flip, g);
      ctx.drawImage(im, -16 * SP, -19.5 * SP, 32 * SP, 39 * SP);
      ctx.restore();
    });
    windLines(ctx, t, dir, FOOT[0], FOOT[1]);
    smoke(ctx, t - T_POOF1, FOOT[0], bodyY);                           // 嘭（烟雾在最前面，把"变身"挡住）
  }

  root.ClaudeChanAnims = Object.assign(root.ClaudeChanAnims || {}, {
    book: { name: '变成书', duration: DUR * SLOW, size: [W, H], foot: FOOT, hideHer: HIDE_HER.map((v) => v * SLOW), draw,
            ready: () => Promise.all([...Object.values(IMG), ...SHEETS].map((im) => im.decode().catch(() => {}))) },
  });
})(typeof window !== 'undefined' ? window : globalThis);
