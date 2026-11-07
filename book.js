// 对话框背景：一本合上的书（端视），用像素画出来
// 左：圆弧书脊 + 书脊和书页之间的月牙形空隙；中：书页（纸张略微不齐，切口有小缺口）；
// 上下：书皮，右端比书页探出一点；底下一道平平的影子。
(function (root) {
  'use strict';
  const P = 2;                 // 1 个"书本像素" = 2 个 CSS 像素
  const TC = 8, BC = 4;        // 上 / 下书皮厚度（单位：书本像素）
  const S = 11;                // 书脊 + 空隙区域宽度
  const OV = 3;                // 书皮在切口一侧比书页多探出的长度
  const SHD = 2;               // 底部影子高度
  const INK = '#3a2418';

  function hex(c) {
    c = c.trim();
    if (c[0] === '#') {
      const n = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1);
      return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
    }
    const m = c.match(/\d+/g) || [0, 0, 0];
    return m.slice(0, 3).map(Number);
  }
  const mix = (a, b, k) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')';

  // 固定种子的伪随机，保证同一尺寸每次画出来一样（不会闪）
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function draw(canvas, cssW, cssH, colors) {
    const dpr = root.devicePixelRatio || 1;
    const W = Math.max(30, Math.round(cssW / P)), H = Math.max(20, Math.round(cssH / P));
    canvas.width = W * P * dpr;
    canvas.height = H * P * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(P * dpr, 0, 0, P * dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

    const cover = hex(colors.cover), hi = hex(colors.hi), lo = hex(colors.lo);
    const black = [30, 18, 12];
    const paper = [247, 240, 222], paperShade = [233, 222, 196];
    const BH = H - SHD;               // 书本身的高度（不含影子）
    const PT = TC, PB = BH - BC - 1;  // 书页的上下行
    const PH = PB - PT + 1;
    const rand = rng(W * 131 + H * 7);

    // ---- 每一行的边界
    const bulge = (y) => Math.sin(Math.PI * y / (BH - 1));             // 书脊的弧度（中间最鼓）
    const xOut = (y) => 1 + Math.round(4.5 * (1 - Math.pow(bulge(y), 0.8)));   // 书脊外沿（更圆）
    const xIn = (y) => xOut(y) + 3;                                      // 书脊内沿（书皮厚 3）
    const pageBulge = (y) => Math.sin(Math.PI * (y - PT) / Math.max(1, PH - 1));
    const pl = (y) => S - Math.round(2 * pageBulge(y));                  // 书页背部也是圆的，但没书脊鼓
    // 切口：纸张不完全齐平 —— 一小段一小段地错开 0~2 格
    const jag = new Array(BH).fill(0);
    for (let y = PT; y <= PB;) {
      const run = 2 + Math.floor(rand() * 4);
      const j = [0, 0, 1, 0, 1, 2, 0, 1][Math.floor(rand() * 8)];
      for (let k = 0; k < run && y <= PB; k++, y++) jag[y] = j;
    }
    const pr = (y) => W - 1 - OV - jag[y];

    // ---- 影子（平平的一条，稍微往左偏，像参考图那样）
    ctx.fillStyle = 'rgba(43,26,20,0.22)';
    ctx.fillRect(2, BH - 1, W - OV - 6, SHD + 1);

    // ---- 书皮（上 / 下），左端从书脊外沿开始
    for (let y = 0; y < BH; y++) {
      const isTop = y < TC, isBot = y > PB;
      if (!isTop && !isBot) continue;
      let c = cover;
      if (y === 1) c = hi;                         // 上书皮顶部高光
      if (y === TC - 1) c = lo;                    // 上书皮底面阴影
      if (y === PB + 1) c = hi;                    // 下书皮内侧高光
      if (y === BH - 2) c = lo;
      px(xOut(y), y, W - xOut(y), 1, mix(c, c, 0));
    }

    // ---- 书脊（圆弧）
    for (let y = TC; y <= PB; y++) {
      const a = xOut(y), b = xIn(y);
      px(a, y, 1, 1, mix(cover, hi, 0.5));         // 弧面高光
      px(a + 1, y, b - a - 1, 1, mix(cover, lo, 0.15));
      // 月牙形空隙：书脊内壁和书页背部之间
      const gapL = b, gapR = pl(y);
      if (gapR > gapL) {
        px(gapL, y, gapR - gapL, 1, mix(lo, black, 0.55));
        px(gapL, y, 1, 1, mix(lo, black, 0.25)); // 内壁一点反光
      }
    }

    // ---- 书页
    for (let y = PT; y <= PB; y++) {
      const a = pl(y), b = pr(y);
      px(a, y, b - a + 1, 1, mix(paper, paper, 0));
      px(a, y, 2, 1, mix(paper, paperShade, 0.9));                  // 背部圆角暗一点
      px(a + 2, y, 2, 1, mix(paper, paperShade, 0.4));
      if (y === PT) px(a, y, b - a + 1, 1, mix(paper, paperShade, 0.8));  // 上书皮压出的阴影
      // 极淡的纸张纹：只在靠切口那一段明显一点
      if ((y - PT) % 3 === 2) {
        px(a + 4, y, Math.max(0, b - a - 14), 1, 'rgba(120,90,60,0.035)');
        px(b - 10, y, 10, 1, 'rgba(120,90,60,0.09)');
      }
    }
    // 切口上的几处小缺口（像参考图里纸页不齐的地方）
    const notches = Math.max(2, Math.round(PH / 9));
    for (let i = 0; i < notches; i++) {
      const y = PT + 3 + Math.floor(rand() * Math.max(1, PH - 6));
      const b = pr(y);
      px(b - 3, y, 4, 1, 'rgba(58,36,24,0.55)');
      px(b - 3, y - 1, 1, 1, 'rgba(58,36,24,0.35)');
      px(b + 1, y, 1, 1, 'rgba(0,0,0,0)');
    }

    // ---- 描边：整本书外轮廓 + 书页和书皮交界
    const mask = (x, y) => {
      if (y < 0 || y >= BH || x < 0 || x >= W) return false;
      if (y < TC || y > PB) return x >= xOut(y);
      return x >= xOut(y) && x <= pr(y);
    };
    ctx.fillStyle = INK;
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask(x, y)) continue;
        if (!mask(x - 1, y) || !mask(x + 1, y) || !mask(x, y - 1) || !mask(x, y + 1)) ctx.fillRect(x, y, 1, 1);
      }
    }
    // 书页和书皮之间、书页和空隙之间的细线
    ctx.fillStyle = 'rgba(58,36,24,0.55)';
    for (let x = pl(PT); x <= pr(PT); x++) ctx.fillRect(x, PT - 1, 1, 1);
    for (let x = pl(PB); x <= pr(PB); x++) ctx.fillRect(x, PB + 1, 1, 1);
    for (let y = PT; y <= PB; y++) ctx.fillRect(pl(y) - 1, y, 1, 1);
  }

  root.ClaudeChanBook = { draw, P, TC, BC, S, OV, SHD };
})(window);
