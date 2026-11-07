// Claude 娘 · 计算器 —— 界面（像素风；数字和符号全部用自带的点阵字画，不依赖系统字体）
(function (root) {
  'use strict';
  const ICON = 'data:image/png;base64,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';
  // ---- 5×7 点阵字（宽度不一定是 5）
  const G = {
    '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
    '÷': ['.....', '..#..', '.....', '#####', '.....', '..#..', '.....'],
    '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
    '.': ['..', '..', '..', '..', '..', '##', '##'],
    ',': ['..', '..', '..', '..', '##', '.#', '#.'],
    '%': ['##...', '##..#', '...#.', '..#..', '.#...', '#..##', '...##'],
    '±': ['..#..', '..#..', '#####', '..#..', '..#..', '.....', '#####'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '(': ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'],
    ')': ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'],
    '√': ['...###', '...#..', '...#..', '#..#..', '.#.#..', '.##...', '..#...'],
    '²': ['##.', '..#', '.#.', '###', '...', '...', '...'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    'e': ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
    's': ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
    'q': ['.....', '.....', '.####', '#...#', '.####', '....#', '....#'],
    'r': ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
    'n': ['.....', '.....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
    'g': ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
    'a': ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
    't': ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
    '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
    'ˣ': ['#.#', '.#.', '#.#', '...', '...', '...', '...'],
    'ʸ': ['#.#', '#.#', '.##', '..#', '##.', '...', '...'],
    '▾': ['.....', '.....', '#####', '.###.', '..#..', '.....', '.....'],
    '⌫': ['...######', '..#.....#', '.#..#.#.#', '#....#..#', '.#..#.#.#', '..#.....#', '...######'],
    ' ': ['..', '..', '..', '..', '..', '..', '..'],
  };
  // 宽度：字形本身 + 1 列间距
  const widthOf = (s) => [...s].reduce((w, ch) => w + ((G[ch] || G[' '])[0].length + 1), 0) - 1;
  // 把一串字画到 canvas 上（scale = 每个点多少 CSS 像素），按设备像素清晰绘制
  function pixText(cv, text, scale, color, opts = {}) {
    const dpr = root.devicePixelRatio || 1;
    const w = Math.max(1, widthOf(text)) * scale, h = 7 * scale;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    let x = 0;
    for (const ch of text) {
      const gl = G[ch] || G[' '];
      for (let r = 0; r < 7; r++) for (let c = 0; c < gl[r].length; c++) {
        if (gl[r][c] !== '#') continue;
        if (opts.shadow) { g.fillStyle = opts.shadow; g.fillRect(x + c * scale + scale / 2, r * scale + scale / 2, scale, scale); }
        g.fillStyle = color; g.fillRect(x + c * scale, r * scale, scale, scale);
      }
      x += (gl[0].length + 1) * scale;
    }
    return cv;
  }

  const FONT = '"Zpix", "Fusion Pixel 12px", "Ark Pixel 12px", "Unifont", ui-monospace, "SFMono-Regular", Menlo, "PingFang SC", "Microsoft YaHei", monospace';
  const CSS = `
  .calc { position: fixed; z-index: 1; pointer-events: auto; width: 268px; background: #fbf3e2; color: #3a2418; border: 2px solid #4f2414;
    box-shadow: 4px 4px 0 rgba(79, 36, 20, .35); user-select: none; -webkit-user-select: none; font-family: ${FONT}; outline: none;
    transition: box-shadow .15s; }
  .calc.focus { box-shadow: 4px 4px 0 rgba(196, 86, 42, .55); }
  .calc * { box-sizing: border-box; }
  .calc canvas { display: block; image-rendering: pixelated; pointer-events: none; }
  /* 标题栏：和右键菜单的书签头一样 */
  .calc .c-bar { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 4px 0 6px; background: #7a3b22; cursor: move;
    border-bottom: 2px solid #4f2414; touch-action: none; }
  .calc .c-bar img { width: 18px; height: 18px; image-rendering: pixelated; pointer-events: none; }
  .calc .c-bar .t { color: #f3d08a; font-size: 11px; letter-spacing: 2px; text-shadow: 1px 1px 0 #4f2414; }
  .calc .c-bar .x { margin-left: auto; width: 18px; height: 18px; display: grid; place-items: center; cursor: pointer;
    background: #9a5534; border: 2px solid #4f2414; }
  .calc .c-bar .x:hover { background: #c4562a; }
  /* 显示屏：一页横线纸，右上角夹着书签 */
  .calc .c-screen { position: relative; margin: 8px 8px 4px; height: 92px; padding: 10px 12px 8px;
    background: #fffaf0 repeating-linear-gradient(to bottom, transparent 0 17px, #f1e4cf 17px 18px);
    border: 2px solid #4f2414; box-shadow: inset 2px 2px 0 #efe0c6; display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; gap: 10px; overflow: hidden; }
  .calc .c-screen::before { content: ''; position: absolute; left: 14px; top: 0; bottom: 0; width: 2px; background: #f2c7b4; }
  .calc .c-ribbon { position: absolute; right: 14px; top: -2px; width: 10px; height: 22px; background: #d97757;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%); }
  .calc .c-spark { position: absolute; left: 22px; top: 8px; }
  .calc .c-expr { min-height: 14px; margin-right: 18px; max-width: 180px; display: flex; justify-content: flex-end; overflow: hidden; }
  .calc .c-expr canvas { flex-shrink: 0; }
  .calc .c-main { min-height: 35px; display: flex; align-items: flex-end; justify-content: flex-end; max-width: 220px; overflow: hidden; }
  .calc .c-main canvas { flex-shrink: 0; }
  .calc .c-err { display: none; font-size: 20px; line-height: 35px; letter-spacing: 1px; color: #3a2418; white-space: nowrap; }
  .calc.err .c-main canvas { display: none; }
  .calc.err .c-err { display: block; }
  /* 记忆行 */
  .calc .c-mem { display: grid; grid-template-columns: repeat(6, 1fr); margin: 0 8px; height: 26px; }
  .calc .c-mem .m { display: grid; place-items: center; cursor: pointer; }
  .calc .c-mem .m:hover, .calc .c-mem .m.on { background: #f6dcc2; }
  .calc .c-mem .m.off { opacity: .35; cursor: default; }
  .calc .c-mem .m.off:hover { background: none; }
  /* 键盘 */
  .calc .c-body { position: relative; }
  .calc .c-keys { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 34px; gap: 5px; padding: 4px 10px 12px 8px; }
  .calc .k[data-k="="] { grid-row: span 2; }
  .calc .k[data-k="0"] { grid-column: span 2; }
  .calc .k { position: relative; display: grid; place-items: center; cursor: pointer; border: 2px solid #4f2414; box-shadow: 2px 2px 0 #4f2414;
    background: #fffaf2; }
  .calc .k:hover { filter: brightness(1.04); }
  .calc .k:active, .calc .k.down { transform: translate(2px, 2px); box-shadow: none; }
  .calc .k.fn { background: #f3e3c8; }
  .calc .k.op { background: #f6dcc2; }
  .calc .k.eq { background: #d97757; box-shadow: 2px 2px 0 #4f2414, inset -2px -2px 0 #b5502c, inset 2px 2px 0 #eb9a76; }
  .calc .k.eq:active, .calc .k.eq.down { box-shadow: inset -2px -2px 0 #b5502c, inset 2px 2px 0 #eb9a76; }
  /* 左括号右下角的小数字：还有几个括号没关上 */
  .calc .k .cnt { position: absolute; right: 6px; bottom: 4px; }
  .calc.err .k.nerr { opacity: .4; cursor: default; }
  .calc.err .k.nerr:active { transform: none; box-shadow: 2px 2px 0 #4f2414; }
  .calc.err .c-mem .m { opacity: .35; cursor: default; }
  /* 记忆列表：盖在键盘上面，像夹在书里的一张便签 */
  .calc .c-list { position: absolute; inset: 0 8px 10px 8px; display: none; flex-direction: column; background: #fffaf0;
    border: 2px solid #4f2414; box-shadow: 2px 2px 0 #4f2414; }
  .calc.list .c-list { display: flex; }
  .calc .c-list .lh { flex: none; padding: 3px 8px; font-size: 11px; color: #a07a62; border-bottom: 1px dashed #e0c9a8; display: flex; }
  .calc .c-list .lh .clr { margin-left: auto; color: #c4562a; cursor: pointer; }
  .calc .c-list .lh .clr:hover { text-decoration: underline; }
  .calc .c-list .rows { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #d9b896 transparent; }
  .calc .c-list .row { padding: 8px 10px 6px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; cursor: pointer;
    border-bottom: 1px solid #f1e4cf; }
  .calc .c-list .row:hover { background: #f6dcc2; }
  .calc .c-list .row .bt { display: flex; gap: 4px; visibility: hidden; }
  .calc .c-list .row:hover .bt { visibility: visible; }
  .calc .c-list .row .bt span { padding: 3px 5px; border: 2px solid #4f2414; background: #fbf3e2; cursor: pointer; }
  .calc .c-list .row .bt span:hover { background: #fffaf2; }
  `;

  // 7 行 4 列；= 占两行，0 占两格
  const KEYS = [
    ['%', 'fn'], ['CE', 'fn'], ['C', 'fn'], ['⌫', 'fn'],
    ['(', 'fn'], [')', 'fn'], ['1/x', 'fn'], ['÷', 'op'],
    ['10^x', 'fn'], ['x^y', 'fn'], ['±', 'fn'], ['×', 'op'],
    ['7'], ['8'], ['9'], ['-', 'op'],
    ['4'], ['5'], ['6'], ['+', 'op'],
    ['1'], ['2'], ['3'], ['=', 'eq'],
    ['0'], ['.'],
  ];
  const LABEL = { '10^x': '10ˣ', 'x^y': 'xʸ' };
  // 出错时还能按的键（和 Windows 一样，其余的变灰）
  const OK_IN_ERR = /^(\d|\.|CE|C|⌫|=|\()$/;
  const INK = '#3a2418', ORANGE = '#c4562a', MUTED = '#a07a62';

  // 小小的 Claude 光芒（像素）
  function spark(cv, s) {
    const P = ['..#..', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '..#..'];
    const dpr = root.devicePixelRatio || 1;
    cv.width = 5 * s * dpr; cv.height = 7 * s * dpr; cv.style.width = 5 * s + 'px'; cv.style.height = 7 * s + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#d97757';
    P.forEach((row, r) => [...row].forEach((c, i) => { if (c === '#') g.fillRect(i * s, r * s, s, s); }));
  }
  // 在 maxW 宽度里能放下就用 big，放不下一点点缩小，最小 min
  function fitScale(text, big, min, maxW) {
    let sc = big;
    while (sc > min && widthOf(text) * sc > maxW) sc -= 0.25;
    return sc;
  }

  function build(container) {
    const st = document.createElement('style'); st.textContent = CSS; container.appendChild(st);
    const el = document.createElement('div'); el.className = 'calc'; el.tabIndex = -1;
    el.innerHTML = `
      <div class="c-bar"><img alt=""><span class="t">Claude娘 · 计算器</span><span class="x" title="关掉（会记住现在算到哪）"><canvas></canvas></span></div>
      <div class="c-screen"><div class="c-ribbon"></div><canvas class="c-spark"></canvas>
        <div class="c-expr"><canvas></canvas></div><div class="c-main"><canvas></canvas><span class="c-err"></span></div></div>
      <div class="c-mem"></div>
      <div class="c-body"><div class="c-keys"></div>
        <div class="c-list"><div class="lh"><span>记忆</span><span class="clr">全部清除</span></div><div class="rows"></div></div></div>`;
    container.appendChild(el);
    el.querySelector('.c-bar img').src = ICON;
    pixText(el.querySelector('.c-bar .x canvas'), '×', 1.6, '#f3d08a');
    spark(el.querySelector('.c-spark'), 2);
    const mem = el.querySelector('.c-mem');
    ['MC', 'MR', 'M+', 'M-', 'MS', 'M▾'].forEach((m) => {
      const d = document.createElement('div'); d.className = 'm'; d.dataset.m = m;
      d.title = { MC: '清除所有记忆', MR: '调出记忆', 'M+': '加到记忆里', 'M-': '从记忆里减去', MS: '存进记忆', 'M▾': '看看记忆列表' }[m];
      d.appendChild(pixText(document.createElement('canvas'), m, 1.6, INK)); mem.appendChild(d);
    });
    const keys = el.querySelector('.c-keys');
    KEYS.forEach(([lab, kind]) => {
      const d = document.createElement('div'); d.className = 'k' + (kind ? ' ' + kind : '') + (OK_IN_ERR.test(lab) ? '' : ' nerr'); d.dataset.k = lab;
      const col = kind === 'eq' ? '#fffaf2' : kind === 'op' ? ORANGE : INK;
      const sc = /^\d$/.test(lab) || lab === '.' ? 2.4 : 2;
      d.appendChild(pixText(document.createElement('canvas'), LABEL[lab] || lab, sc, col, kind === 'eq' ? { shadow: '#9b3f20' } : {}));
      if (lab === '(') { const c = document.createElement('canvas'); c.className = 'cnt'; d.appendChild(c); }
      keys.appendChild(d);
    });
    const rows = el.querySelector('.c-list .rows');
    let lastMem = null;

    // 显示：v = Calc.view()；listOpen = 记忆列表是不是开着
    function render(v, listOpen) {
      const ex = v.expr || ' ';
      pixText(el.querySelector('.c-expr canvas'), ex, fitScale(ex, 2, 1.5, 180), MUTED);
      el.classList.toggle('err', !!v.err);
      if (v.err) el.querySelector('.c-err').textContent = v.main;
      else pixText(el.querySelector('.c-main canvas'), v.main, fitScale(v.main, 5, 1.5, 220), INK);
      const cnt = keys.querySelector('.cnt');
      if (v.paren) { cnt.style.display = ''; pixText(cnt, String(v.paren), 1.4, ORANGE); } else cnt.style.display = 'none';
      mem.querySelectorAll('.m').forEach((m) => m.classList.toggle('off', !v.memOn && ['MC', 'MR', 'M▾'].includes(m.dataset.m)));
      const open = !!(listOpen && v.memOn);
      el.classList.toggle('list', open);
      mem.querySelector('[data-m="M▾"]').classList.toggle('on', open);
      const sig = JSON.stringify(v.mem);
      if (open && sig !== lastMem) {
        lastMem = sig;
        rows.innerHTML = '';
        v.mem.forEach((x, i) => {
          const r = document.createElement('div'); r.className = 'row'; r.dataset.i = i;
          const txt = root.ClaudeChanCalcCore.fmtNum(x);
          r.appendChild(pixText(document.createElement('canvas'), txt, fitScale(txt, 2.6, 1.25, 206), INK));
          const bt = document.createElement('div'); bt.className = 'bt';
          [['MC', 'del'], ['M+', '+'], ['M-', '-']].forEach(([lab, act]) => {
            const b = document.createElement('span'); b.dataset.act = act; b.appendChild(pixText(document.createElement('canvas'), lab, 1.4, INK)); bt.appendChild(b);
          });
          r.appendChild(bt); rows.appendChild(r);
        });
      }
      if (!open) lastMem = null;
    }
    // 键盘按下时让对应的键也"按下去"一下
    function flash(k) {
      const d = keys.querySelector(`[data-k="${CSS_ESC(k)}"]`);
      if (!d) return;
      d.classList.add('down'); clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove('down'), 110);
    }
    return { el, render, flash, bar: el.querySelector('.c-bar'), close: el.querySelector('.c-bar .x'), mem, keys, rows,
             clearAll: el.querySelector('.c-list .clr') };
  }
  const CSS_ESC = (s) => s.replace(/["\\]/g, '\\$&');
  root.ClaudeChanCalcUI = { build, pixText, widthOf };
})(window);
