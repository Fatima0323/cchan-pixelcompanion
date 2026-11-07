// 特效 · 黑洞：Claude 娘手心里托着一个小黑洞，持续 5 秒
//  - 黑洞本体（像素风）：吸积盘旋转 + 透镜光环 + 两条旋臂 + 被吸进去的粒子 + 星星，上下轻轻浮动
//  - 引力透镜：黑洞附近的网页内容被弯曲（SVG 位移贴图 + backdrop-filter），离开范围就恢复
// 几何都以"格"为单位（1 格 = 1 CSS 像素 × 缩放 k），R = 视界半径
(function (root) {
  'use strict';
  const DUR = 5.0;
  const R = 9.5;                                // 视界半径（格）
  const KS = R / 35;
  const PS = Math.ceil(13.7 * R);               // 本体画布边长（格）
  const C = PS / 2;

  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const rand = rng(7);
  const uni = (a, b) => a + (b - a) * rand();

  const ORANGE = [[255, 244, 214], [255, 214, 140], [255, 168, 72], [236, 112, 40], [196, 66, 26], [130, 36, 14]];
  function heat(u, a) {                         // 0 最热（白）→ 1 最冷（暗红）
    u = Math.min(Math.max(u, 0), 0.999) * (ORANGE.length - 1);
    const i = u | 0, f = u - i, p = ORANGE[i], q = ORANGE[i + 1];
    return `rgba(${(p[0] + (q[0] - p[0]) * f) | 0},${(p[1] + (q[1] - p[1]) * f) | 0},${(p[2] + (q[2] - p[2]) * f) | 0},${a.toFixed(3)})`;
  }

  // ---- 吸积盘（倾斜的椭圆轨道）
  const TILT = -14 * Math.PI / 180, ASP = 0.30, CT = Math.cos(TILT), ST = Math.sin(TILT);
  const disk = Array.from({ length: 360 }, () => {
    const r = uni(1.35, 2.75) * R;
    return { r, ph: uni(0, 6.283), w: 3.6 * Math.pow(1.35 * R / r, 1.5), sz: rand() < 0.25 ? 2 : 1 };
  });
  // ---- 透镜光环（盘的背面被弯到黑洞上下方）
  const ring = Array.from({ length: 220 }, () => ({ r: uni(1.06, 1.32) * R, ph: uni(0, 6.283), w: uni(2.2, 3.4) }));
  // ---- 被吸进去的粒子（螺旋落入，带拖尾）
  const fall = Array.from({ length: 90 }, () => ({
    t0: uni(0, 2), life: uni(1.3, 2.2), a: uni(0, 6.283), r0: uni(95, 165) * KS, spin: uni(2.4, 4.0), col: uni(0.25, 0.8),
  }));
  const STARS = [[-62, -78, 0, 3], [70, -60, 1.3, 2], [-85, 18, 0.7, 3], [58, 40, 2.1, 2], [-30, -110, 1.8, 2], [95, -10, 0.4, 2], [-70, 75, 2.6, 2]]
    .map(([x, y, p, s]) => [x * KS, y * KS, p, s]);

  // 低分辨率画布：1 格 1 像素，最后放大贴上去（像素风）
  const low = document.createElement('canvas'); low.width = low.height = PS;
  const lc = low.getContext('2d');
  const armC = document.createElement('canvas'); armC.width = armC.height = PS;
  const ac = armC.getContext('2d');
  const armImg = ac.createImageData(PS, PS);
  const LR = new Float32Array(PS * PS), LT = new Float32Array(PS * PS);
  for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) {
    const dx = x + 0.5 - C, dy = y + 0.5 - C;
    LR[y * PS + x] = Math.hypot(dx, dy); LT[y * PS + x] = Math.atan2(dy, dx);
  }

  const put = (g, x, y, col, s = 1) => { g.fillStyle = col; g.fillRect(Math.floor(x + C), Math.floor(y + C), s, s); };
  function disc(g, r, col) {                    // 像素圆
    g.fillStyle = col;
    const r2 = r * r, n = Math.ceil(r);
    for (let y = -n; y <= n; y++) {
      const half = Math.sqrt(Math.max(0, r2 - (y + 0.5) * (y + 0.5)));
      if (half <= 0) continue;
      const x0 = Math.round(C - half), x1 = Math.round(C + half);
      g.fillRect(x0, Math.floor(C) + y, x1 - x0, 1);
    }
  }
  const ell = (r, ph) => { const x = r * Math.cos(ph), y = r * Math.sin(ph) * ASP; return [x * CT - y * ST, x * ST + y * CT, Math.sin(ph)]; };

  // 画一帧本体到 low（t 秒）
  function body(t) {
    lc.clearRect(0, 0, PS, PS);
    // 旋臂：两条对数螺旋
    const d = armImg.data;
    for (let i = 0; i < PS * PS; i++) {
      const r = LR[i];
      let a = Math.cos(2 * (LT[i] - 1.6 * t) - 2.4 * Math.log(Math.max(r, 1) / R));
      a = a > 0 ? a * a * a * a : 0;
      a *= Math.min(1, Math.max(0, (r - R * 1.25) / (R * 0.5))) * Math.exp(-Math.pow((r - R * 2.2) / (R * 1.4), 2));
      const dith = (((i % PS) + ((i / PS) | 0)) & 1) ? 1 : 0.88;
      d[i * 4] = 214; d[i * 4 + 1] = 84; d[i * 4 + 2] = 30; d[i * 4 + 3] = Math.min(1, a * 1.4) * 215 * dith;
    }
    ac.putImageData(armImg, 0, 0);
    lc.drawImage(armC, 0, 0);
    const front = [];
    // 吸积盘（两节拖尾）
    for (const p of disk) {
      const u = (p.r - 1.35 * R) / (1.4 * R);
      for (const [lag, al] of [[0, 1], [0.025, 0.55], [0.05, 0.25]]) {
        const ph = p.ph + p.w * (t - lag);
        const [x, y, z] = ell(p.r, ph);
        let col = 0.1 + 0.75 * u, br = (0.55 + 0.45 * Math.cos(ph)) * al;
        const h = Math.hypot(x, y);
        if (z <= 0 && h < R * 1.02) continue;                     // 后半圈被黑洞挡住
        if (z > 0 && h < R * 1.05) { col = 0.02 + 0.3 * u; br = Math.max(br, 0.75 * al); }
        const c = heat(col, Math.min(1, 0.25 + br)), s = lag === 0 ? p.sz : 1;
        if (z > 0) front.push([x, y, c, s]); else put(lc, x, y, c, s);
      }
    }
    // 透镜光环
    ring.forEach((p, i) => {
      const ph = p.ph + p.w * t;
      const r = p.r * (1 + 0.04 * Math.sin(3 * ph + t * 2));
      const fl = 0.5 + 0.5 * Math.sin(ph * 5 + t * 9 + i);
      const top = Math.pow(Math.abs(Math.sin(ph)), 0.6);
      put(lc, r * Math.cos(ph), r * Math.sin(ph) * 0.92, heat(0.02 + 0.35 * (1 - fl), Math.min(1, 0.35 + 0.65 * top * (0.5 + 0.5 * fl))), fl > 0.85 && top > 0.6 ? 2 : 1);
    });
    // 黑洞：光子环 → 橙边 → 暗边 → 纯黑
    const flick = 0.75 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    disc(lc, R + 1.2, `rgba(255,236,200,${flick})`);
    disc(lc, R + 0.4, '#ff963c');
    disc(lc, R - 0.5, '#1c0a06');
    disc(lc, R - 2, '#000');
    for (const [x, y, c, s] of front) put(lc, x, y, c, s);
    // 被吸进去的粒子
    for (const p of fall) {
      for (const [lag, al] of [[0, 1], [0.03, 0.7], [0.06, 0.45], [0.09, 0.28], [0.12, 0.15]]) {
        const tt = ((t - lag - p.t0) % (p.life + 0.4) + (p.life + 0.4)) % (p.life + 0.4);
        const u = tt / p.life;
        if (u > 1) continue;
        const e = Math.pow(u, 2.2);
        const r = p.r0 * (1 - e) + R * 0.95 * e, a = p.a + p.spin * e * 2.2;
        const x = r * Math.cos(a), y = r * Math.sin(a) * 0.62;
        if (Math.hypot(x, y) < R) continue;
        put(lc, x, y, heat(p.col * (1 - e) + 0.02, al * Math.min(1, u / 0.1)), lag === 0 ? 2 : 1);
      }
    }
    // 星星：一闪一闪，慢慢被拽着绕圈
    const ang = 0.25 * t, ca = Math.cos(ang), sa = Math.sin(ang);
    for (const [sx, sy, ph0, s] of STARS) {
      const x = Math.floor(sx * ca - sy * sa + C), y = Math.floor(sx * sa + sy * ca + C);
      const k = 0.5 + 0.5 * Math.sin(2 * Math.PI * (t / 1.7) + ph0 * 2.3);
      const L = 1 + Math.round(k * s);
      lc.fillStyle = `rgba(255,150,60,${((120 + 135 * k) / 255).toFixed(3)})`;
      lc.fillRect(x - L, y, 2 * L + 1, 1); lc.fillRect(x, y - L, 1, 2 * L + 1);
      lc.fillStyle = '#fffaeb'; lc.fillRect(x, y, 1, 1);
    }
  }

  // 出现 / 消失的节奏：0 → 1 → 0
  const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  function grow(t) { return smooth(t / 0.55) * (1 - smooth((t - (DUR - 0.6)) / 0.6)); }
  function lensStrength(t) { return smooth((t - 0.15) / 0.9) * (1 - smooth((t - (DUR - 0.9)) / 0.8)); }
  const bob = (t) => 7 * KS * Math.sin(2 * Math.PI * t / 2.6);   // 格

  // 画到屏幕上的画布：ctx 已经按 (k*dpr) 缩放，原点 = 黑洞中心
  function draw(ctx, t) {
    const g = grow(t);
    if (g <= 0.001) return;
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 1.3);
    // 暗影 + 光晕（软的，画在网页上面）
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 3.2 * g);
    sh.addColorStop(0, `rgba(40,14,10,${0.32 * g})`); sh.addColorStop(1, 'rgba(40,14,10,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, R * 3.2 * g, 0, 6.283); ctx.fill();
    const hr = R * 2.6 * g, ha = (0.42 + 0.08 * pulse) * g;
    const hl = ctx.createRadialGradient(0, 0, R * 0.9 * g, 0, 0, hr);
    hl.addColorStop(0, `rgba(255,170,90,${ha})`); hl.addColorStop(0.35, `rgba(255,170,90,${ha * 0.55})`); hl.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(0, 0, hr, 0, 6.283); ctx.fill();
    body(t);
    ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.scale(g, g);
    ctx.drawImage(low, -C, -C, PS, PS);
    ctx.restore();
  }

  // ---- 引力透镜：位移贴图（只做一次）。偏移 = 往中心方向 E²/r（越靠近越强），再带一点旋转
  // 在 r < E 的地方会采到对面的内容（就是爱因斯坦环里那种"翻过来"的像）；超过 LENS 半径平滑衰减到 0
  const LENS = 150;                             // 透镜作用半径（格）
  const E = 3.1 * R;                            // 爱因斯坦半径
  const M = 2.3 * E;                            // 最大偏移
  let mapURL = null;
  function lensMap() {
    if (mapURL) return mapURL;
    const N = 192, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d'), im = g.createImageData(N, N), D = 2 * LENS;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = (x + 0.5) / N * D - LENS, py = (y + 0.5) / N * D - LENS;
      const r = Math.hypot(px, py) + 1e-3;
      const f = smooth((LENS - r) / (LENS * 0.55));
      const m = Math.min(E * E / r, M) * f;
      const ux = px / r, uy = py / r;
      const ox = -ux * m - uy * m * 0.22, oy = -uy * m + ux * m * 0.22;   // 指向中心 + 一点点涡旋
      const i = (y * N + x) * 4;
      im.data[i] = Math.round(127.5 + ox / (2 * M) * 255);
      im.data[i + 1] = Math.round(127.5 + oy / (2 * M) * 255);
      im.data[i + 2] = 0; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return (mapURL = cv.toDataURL());
  }

  root.ClaudeChanFx = root.ClaudeChanFx || {};
  root.ClaudeChanFx.blackhole = {
    duration: DUR,
    size: PS,                // 本体画布边长（格）
    lens: { radius: LENS, maxOffset: M, map: lensMap },
    bob, grow, lensStrength, draw,
  };
})(window);
