// Claude 娘 · 计算器 —— 面板：打开 / 关掉 / 拖动 / 鼠标和键盘 / 记住上次算到哪
// 算到哪（整个计算器的状态）存在 chrome.storage.local 里：关掉再开、换个网页、重启浏览器都会回到这里；
// 几个网页同时开着计算器时，在一个里按，另一个也会跟着变。
(function (root) {
  'use strict';
  const Core = root.ClaudeChanCalcCore, UI = root.ClaudeChanCalcUI;
  const KEY = 'calcState', POS = 'calcPos';
  const me = Math.random().toString(36).slice(2);   // 这一页的记号：自己写进去的改动不用再读回来
  const store = {
    get(keys, cb) { try { chrome.storage.local.get(keys, (v) => { void chrome.runtime.lastError; cb(v || {}); }); } catch (e) { cb({}); } },
    set(o) { try { chrome.storage.local.set(o, () => void chrome.runtime.lastError); } catch (e) {} },
  };

  // 键盘 → 计算器按键（和 Windows 计算器一样）
  function keyOf(e) {
    const k = e.key;
    if (/^[0-9]$/.test(k)) return k;
    if (k === '.' || k === ',' || k === 'Decimal') return '.';
    if (k === '+') return '+';
    if (k === '-' || k === 'Subtract') return '-';
    if (k === '*' || k === 'x' || k === 'X' || k === 'Multiply') return '×';
    if (k === '/' || k === 'Divide') return '÷';
    if (k === 'Enter' || k === '=') return '=';
    if (k === 'Backspace') return '⌫';
    if (k === 'Delete') return 'CE';
    if (k === 'Escape') return 'C';
    if (k === '%') return '%';
    if (k === 'r' || k === 'R') return '1/x';
    if (k === '^' || k === 'y' || k === 'Y') return 'x^y';
    if (k === '(' || k === ')') return k;
    if (k === 'F9') return '±';
    return null;
  }

  function create({ shadow, anchor }) {
    let calc = Core.Calc();
    let ui = null, open = false, listOpen = false, focused = false, pos = null, saveT = 0, dirty = false;
    let ready = false, wantShow = false;   // 存档读回来之前先不显示，免得闪一下 0 和默认位置

    store.get({ [KEY]: null, [POS]: null }, (v) => {
      if (v[KEY] && v[KEY].s) calc = Core.Calc(v[KEY].s);
      if (v[POS]) pos = v[POS];
      ready = true;
      if (wantShow) { wantShow = false; show(); }
    });
    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local' || !ch[KEY]) return;
        const nv = ch[KEY].newValue;
        if (!nv || nv.by === me) return;
        calc = Core.Calc(nv.s);          // 别的网页里按了 → 跟上
        if (open) render();
      });
    } catch (e) {}

    function save() {
      dirty = true;
      clearTimeout(saveT);
      saveT = setTimeout(flush, 120);
    }
    function flush() {
      clearTimeout(saveT);
      if (!dirty) return;
      dirty = false;
      store.set({ [KEY]: { s: calc.state(), by: me, t: Date.now() } });
    }
    root.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

    function render() { if (ui) ui.render(calc.view(), listOpen); }
    function act(fn) { fn(); if (!calc.view().memOn) listOpen = false; render(); save(); }

    function press(k, fromKeyboard) {
      if (fromKeyboard) ui.flash(k);
      act(() => calc.press(k));
    }

    // ---- 位置：第一次出现在她左边，拖过之后就记住拖到的地方
    function clamp(l, t) {
      const w = ui.el.offsetWidth, h = ui.el.offsetHeight;
      return [Math.round(Math.max(4, Math.min(l, innerWidth - w - 8))), Math.round(Math.max(4, Math.min(t, innerHeight - h - 8)))];
    }
    function place() {
      let l, t;
      if (pos) { l = pos.left; t = pos.top; }
      else {
        const r = anchor(), w = ui.el.offsetWidth, h = ui.el.offsetHeight;
        l = r.left - w - 12;
        if (l < 4) l = r.right + 12;
        t = r.bottom - h;
      }
      [l, t] = clamp(l, t);
      ui.el.style.left = l + 'px'; ui.el.style.top = t + 'px';
    }

    function build() {
      ui = UI.build(shadow);
      const el = ui.el;
      el.style.display = 'none';
      // 点到计算器 = 让它接住键盘
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (shadow.activeElement !== el) el.focus({ preventScroll: true }); });
      el.addEventListener('mousedown', (e) => e.preventDefault());   // 不让网页里的输入框抢回焦点 / 选中文字
      el.addEventListener('focus', () => { focused = true; el.classList.add('focus'); });
      el.addEventListener('blur', () => { focused = false; el.classList.remove('focus'); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });
      el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

      ui.keys.addEventListener('click', (e) => {
        const k = e.target.closest('.k');
        if (!k || (calc.view().err && k.classList.contains('nerr'))) return;
        press(k.dataset.k);
      });
      ui.mem.addEventListener('click', (e) => {
        const m = e.target.closest('.m');
        if (!m || m.classList.contains('off') || calc.view().err) return;
        if (m.dataset.m === 'M▾') { listOpen = !listOpen; render(); return; }
        if (m.dataset.m === 'MC') listOpen = false;
        act(() => calc.press(m.dataset.m));
      });
      ui.rows.addEventListener('click', (e) => {
        const row = e.target.closest('.row'); if (!row) return;
        const i = +row.dataset.i, b = e.target.closest('[data-act]');
        if (!b) { listOpen = false; act(() => calc.recall(i)); return; }
        const a = b.dataset.act;
        act(() => (a === 'del' ? calc.memDelete(i) : calc.memOp(i, a)));
      });
      ui.clearAll.addEventListener('click', () => { listOpen = false; act(() => calc.press('MC')); });
      ui.close.addEventListener('pointerdown', (e) => e.stopPropagation());
      ui.close.addEventListener('click', (e) => { e.stopPropagation(); close(); });

      // 拖标题栏
      ui.bar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('.x')) return;
        const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        try { ui.bar.setPointerCapture(e.pointerId); } catch (err) {}
        const mv = (ev) => {
          const [l, t] = clamp(ev.clientX - dx, ev.clientY - dy);
          el.style.left = l + 'px'; el.style.top = t + 'px';
        };
        const up = () => {
          ui.bar.removeEventListener('pointermove', mv); ui.bar.removeEventListener('pointerup', up); ui.bar.removeEventListener('pointercancel', up);
          pos = { left: parseInt(el.style.left, 10), top: parseInt(el.style.top, 10) };
          store.set({ [POS]: pos });
        };
        ui.bar.addEventListener('pointermove', mv); ui.bar.addEventListener('pointerup', up); ui.bar.addEventListener('pointercancel', up);
      });
      root.addEventListener('resize', () => { if (open) place(); });
    }

    // 计算器有焦点时：按键、复制、粘贴都归它（calc-keys.js 会挡住网页）
    root.ClaudeChanKeyHook = (e) => {
      if (!open || !focused) return false;
      if (e.type === 'copy' || e.type === 'cut') {
        const v = calc.view();
        if (v.err) return false;
        e.clipboardData.setData('text/plain', v.main.replace(/,/g, ''));
        e.preventDefault();
        return true;
      }
      if (e.type === 'paste') {
        const t = (e.clipboardData.getData('text/plain') || '').trim().replace(/[,\s，]/g, '');
        e.preventDefault();
        if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) act(() => calc.paste(parseFloat(t)));
        return true;
      }
      if (e.isComposing) return false;
      if (e.ctrlKey || e.metaKey || e.altKey) return false;              // Ctrl+C / Ctrl+V 之类交给浏览器（会变成上面的复制粘贴）
      if (e.key === 'Tab' || /^F([1-8]|1[0-2])$/.test(e.key)) return false;   // Tab、F5 刷新、F12 这些不拦
      if (e.type !== 'keydown') return true;
      if (e.key === 'Escape' && listOpen) { listOpen = false; render(); return true; }
      const k = keyOf(e);
      if (k) {
        if (calc.view().err && !/^(\d|\.|CE|C|⌫|=|\()$/.test(k)) return true;
        press(k, true);
      }
      return true;
    };

    function show() {
      if (!ready) { wantShow = true; return; }
      if (!ui) build();
      open = true;
      ui.el.style.display = '';
      render();
      place();
      ui.el.focus({ preventScroll: true });
    }
    function close() {
      wantShow = false;
      if (!ui) return;
      open = false; listOpen = false;
      ui.el.style.display = 'none';
      if (ui.el === shadow.activeElement) ui.el.blur();
      flush();
    }
    return { show, close, toggle: () => (open || wantShow ? close() : show()), isOpen: () => open || wantShow };
  }

  root.ClaudeChanCalc = { create };
})(window);
