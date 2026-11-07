// Claude 娘 · 计算器 —— 计算逻辑
// 按键和显示照着 Windows 计算器来；有括号和 xʸ，所以先算谁按数学规则：括号 > 乘方 > 乘除 > 加减
// 纯逻辑，没有界面；整个状态是一个普通对象，可以直接存进 chrome.storage
(function (root) {
  'use strict';
  const MAX_DIGITS = 16;
  const PREC = { '+': 1, '-': 1, '×': 2, '÷': 2, '^': 3 };

  function fresh() {
    return {
      tokens: [],      // 上面那行里已经定下来的东西：{t:'num', v, text} / {t:'op', o} / {t:'('}
      val: 0,          // 当前显示的数（没在输入时）
      entry: null,     // 正在输入的数字串（'12.5'），没在输入时是 null
      opFresh: false,  // 刚按完运算符或左括号，还没给出新的数（这时用显示的数当这个数）
      curText: null,   // 当前数在上面那行里的写法（比如 10^(3)、(1 + 2)），没有就用数字本身
      justEq: false,   // 刚按完 =
      eqExpr: '',      // 按完 = 之后上面那行显示的东西
      lastOp: null, lastB: null,   // 连按 = 时重复上一次运算
      err: null,       // 出错信息（除数不能为零 …）
      mem: [],         // 记忆（MS 存进去的数，最新的在最前面）
    };
  }

  // ---- 数字格式：最多 16 位有效数字，整数部分加千位逗号；太大太小用科学计数法
  function groupInt(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtNum(x) {
    if (!isFinite(x)) return '0';
    if (x === 0 || Object.is(x, -0)) return '0';
    const ax = Math.abs(x), sign = x < 0 ? '-' : '';
    if (ax >= 1e16 || ax < 1e-15) {
      let [m, e] = ax.toExponential(15).split('e');
      m = m.replace(/\.?0+$/, '');
      return sign + m + 'e' + (e[0] === '-' ? e : '+' + e.replace('+', ''));
    }
    const intDigits = Math.floor(Math.log10(ax)) + 1;
    let s = ax.toFixed(Math.min(100, Math.max(0, MAX_DIGITS - intDigits)));
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    const [ip, fp] = s.split('.');
    return sign + groupInt(ip) + (fp ? '.' + fp : '');
  }
  function fmtEntry(s) {
    const neg = s.startsWith('-'); if (neg) s = s.slice(1);
    const [ip, fp] = s.split('.');
    return (neg ? '-' : '') + groupInt(ip) + (s.includes('.') ? '.' + fp : '');
  }
  const digitsIn = (s) => s.replace(/[^0-9]/g, '').replace(/^0+/, '').length;
  // 把 0.1 + 0.2 这类浮点小尾巴修掉（保留 16 位有效数字）
  const tidy = (x) => (x === 0 ? 0 : Number(x.toPrecision(16)));

  // ---- 运算（出错时抛出错误信息）
  class CalcError { constructor(msg) { this.msg = msg; } }
  function compute(a, op, b) {
    let r;
    if (op === '+') r = a + b;
    else if (op === '-') r = a - b;
    else if (op === '×') r = a * b;
    else if (op === '÷') {
      if (b === 0) throw new CalcError(a === 0 ? '结果未定义' : '除数不能为零');
      r = a / b;
    } else if (op === '^') {
      if (a === 0 && b < 0) throw new CalcError('除数不能为零');
      r = Math.pow(a, b);
      if (Number.isNaN(r)) throw new CalcError('输入无效');      // 比如 (-8)^0.5
    }
    if (!isFinite(r)) throw new CalcError('溢出');
    return tidy(r);
  }
  // 一串 [数 运算符 数 运算符 …] 按优先级算。
  // 以运算符结尾时（刚按完运算符）只算能算的部分，返回现在该显示的数，和 Windows 计算器一样：
  // 1 + 2 × 显示 2（乘法要等后面的数），1 × 2 + 显示 2，1 + 2 + 显示 3
  function evalSeq(seq) {
    const vals = [], ops = [];
    const apply = () => { const b = vals.pop(), a = vals.pop(); vals.push(compute(a, ops.pop(), b)); };
    for (const t of seq) {
      if (t.t === 'num') { vals.push(t.v); continue; }
      const p = PREC[t.o];
      while (ops.length && (PREC[ops[ops.length - 1]] > p || (PREC[ops[ops.length - 1]] === p && t.o !== '^'))) apply();   // ^ 从右往左算
      ops.push(t.o);
    }
    if (seq.length && seq[seq.length - 1].t === 'op') return vals[vals.length - 1];
    while (ops.length) apply();
    return vals[0];
  }
  // 上面那行的写法：左括号后面不空格
  function seqText(seq) {
    let out = '';
    for (const t of seq) {
      const piece = t.t === 'num' ? t.text : t.t === 'op' ? t.o : '(';
      out += out === '' || out.endsWith('(') ? piece : ' ' + piece;
    }
    return out;
  }

  function Calc(saved) {
    saved = saved ? Object.assign({}, saved) : null;
    // 0.9.0 早先的存档（没有 tokens，只有一个待算的运算符）→ 换成新格式
    if (saved && !Array.isArray(saved.tokens)) {
      saved.tokens = saved.op && saved.acc != null
        ? [{ t: 'num', v: saved.acc, text: saved.accText || fmtNum(saved.acc) }, { t: 'op', o: saved.op }] : [];
      delete saved.acc; delete saved.accText; delete saved.op;
    }
    const s = Object.assign(fresh(), saved || {});
    s.mem = Array.isArray(s.mem) ? s.mem.slice(0, 20) : [];

    const cur = () => (s.entry !== null ? parseFloat(s.entry) : s.val);
    const commit = () => { if (s.entry !== null) { s.val = parseFloat(s.entry) || 0; s.entry = null; } };
    const openCount = () => s.tokens.filter((t) => t.t === '(').length;
    const lastTok = () => s.tokens[s.tokens.length - 1];
    const levelStart = () => { for (let i = s.tokens.length - 1; i >= 0; i--) if (s.tokens[i].t === '(') return i + 1; return 0; };
    // 当前这个数（刚按完运算符时就用显示的那个数）
    const operand = () => ({ t: 'num', v: s.val, text: s.opFresh ? fmtNum(s.val) : (s.curText || fmtNum(s.val)) });

    function clearAll() {
      const mem = s.mem;
      Object.assign(s, fresh(), { mem });
    }
    function fail(msg, expr) { Object.assign(s, { err: msg, eqExpr: expr || '', entry: null, tokens: [], curText: null, justEq: false, opFresh: false }); }
    // 刚按完 = 之后又开始新的东西：把上一行清掉
    function leaveEq() { if (s.justEq) { s.justEq = false; s.eqExpr = ''; s.tokens = []; s.curText = null; } }

    function digit(d) {
      if (s.err) clearAll();
      leaveEq();
      if (s.entry === null || s.curText !== null) { s.entry = d; s.curText = null; }
      else if (s.entry === '0') s.entry = d;
      else if (s.entry === '-0') s.entry = '-' + d;
      else if (digitsIn(s.entry) < MAX_DIGITS) s.entry += d;
      s.opFresh = false;
    }
    function dot() {
      if (s.err) clearAll();
      leaveEq();
      if (s.entry === null || s.curText !== null) { s.entry = '0.'; s.curText = null; }
      else if (!s.entry.includes('.')) s.entry += '.';
      s.opFresh = false;
    }
    function back() {
      if (s.err) { clearAll(); return; }
      if (s.justEq) { s.justEq = false; s.eqExpr = ''; return; }   // 按完 = 再按退格：只清掉上面那行
      if (s.entry === null || s.curText !== null) return;
      s.entry = s.entry.slice(0, -1);
      if (s.entry === '' || s.entry === '-') s.entry = '0';
    }
    function ce() {
      if (s.err || s.justEq) { clearAll(); return; }
      s.entry = null; s.val = 0; s.curText = null; s.opFresh = false;
    }
    function binop(o) {
      if (s.err) return;
      if (s.justEq) {           // 接着上一次的结果算
        commit();
        s.justEq = false; s.eqExpr = '';
        s.tokens = [{ t: 'num', v: s.val, text: fmtNum(s.val) }, { t: 'op', o }];
        s.opFresh = true; s.curText = null;
        return;
      }
      commit();
      const last = lastTok();
      if (s.opFresh && last && last.t === 'op') last.o = o;          // 连按运算符：换一个
      else s.tokens.push(operand(), { t: 'op', o });
      try { s.val = evalSeq(s.tokens.slice(levelStart())); }
      catch (e) { if (e instanceof CalcError) { fail(e.msg, seqText(s.tokens)); return; } throw e; }
      s.opFresh = true; s.curText = null;
    }
    function openParen() {
      if (s.err) clearAll();
      const wasEq = s.justEq;
      leaveEq();
      if (wasEq) { s.lastOp = null; s.lastB = null; }   // 按完 = 再开括号：是一道新题
      // 前面已经有一个数（打的、10^(…)、(…)、调出来的）：2 ( 就是 2 × (
      const present = !wasEq && !s.opFresh && (s.entry !== null || s.curText !== null || s.val !== 0);
      commit();
      if (present) {
        s.tokens.push(operand(), { t: 'op', o: '×' });
        try { evalSeq(s.tokens.slice(levelStart())); }
        catch (e) { if (e instanceof CalcError) { fail(e.msg, seqText(s.tokens)); return; } throw e; }
      }
      s.tokens.push({ t: '(' });
      s.val = 0; s.entry = null; s.curText = null; s.opFresh = true;
    }
    // 把最里面那层括号算完，收成一个数
    function collapse(toks) {
      let i = toks.length - 1;
      while (toks[i].t !== '(') i--;
      const inner = toks.slice(i + 1);
      const v = evalSeq(inner);
      return toks.slice(0, i).concat({ t: 'num', v, text: '(' + seqText(inner) + ')' });
    }
    function closeParen() {
      if (s.err || s.justEq || !openCount()) return;
      commit();
      const toks = s.tokens.concat(operand());
      try {
        const out = collapse(toks), g = out.pop();
        s.tokens = out; s.val = g.v; s.curText = g.text; s.entry = null; s.opFresh = false;
      } catch (e) { if (e instanceof CalcError) { fail(e.msg, seqText(toks) + ')'); return; } throw e; }
    }
    function equals() {
      if (s.err) { clearAll(); return; }
      commit();
      if (s.justEq || !s.tokens.length) {
        // 连按 = ：把上一次的运算再做一遍
        const a = s.val, aT = s.justEq ? fmtNum(a) : (s.curText || fmtNum(a));
        if (s.lastOp !== null) {
          const expr = `${aT} ${s.lastOp} ${fmtNum(s.lastB)} =`;
          try { s.val = compute(a, s.lastOp, s.lastB); }
          catch (e) { if (e instanceof CalcError) { fail(e.msg, expr); return; } throw e; }
          s.eqExpr = expr;
        } else s.eqExpr = `${aT} =`;
        s.justEq = true; s.opFresh = false; s.curText = null; s.tokens = [];
        return;
      }
      let toks = s.tokens.concat(operand());
      const n = openCount();
      const expr = seqText(toks) + ')'.repeat(n) + ' =';      // 没关上的括号自动补上
      let r;
      try {
        for (let i = 0; i < n; i++) toks = collapse(toks);
        r = evalSeq(toks);
      } catch (e) { if (e instanceof CalcError) { fail(e.msg, expr); return; } throw e; }
      // 记下最后一个运算，连按 = 时重复它（1 + 2 = = → 3 + 2 = 5）
      s.lastOp = null; s.lastB = null;
      if (toks.length >= 3) { s.lastOp = toks[toks.length - 2].o; s.lastB = toks[toks.length - 1].v; }
      s.val = r; s.eqExpr = expr; s.tokens = [];
      s.justEq = true; s.opFresh = false; s.curText = null;
    }
    function unary(kind) {
      if (s.err) return;
      commit();
      const wasEq = s.justEq;
      if (wasEq) { s.justEq = false; s.eqExpr = ''; s.tokens = []; }
      const x = s.val, inner = wasEq || s.opFresh ? fmtNum(x) : (s.curText || fmtNum(x));
      let r, text;
      if (kind === 'pow10') {
        text = `10^(${inner})`;
        r = Math.pow(10, x);
        if (!isFinite(r)) { fail('溢出', text); return; }
        r = tidy(r);
      } else if (kind === 'recip') { if (x === 0) { fail('除数不能为零', `1/(${inner})`); return; } r = tidy(1 / x); text = `1/(${inner})`; }
      else if (kind === 'negate') { r = -x; text = `negate(${inner})`; }
      s.val = r; s.curText = text; s.opFresh = false;
    }
    function negate() {
      if (s.err) return;
      if (s.entry !== null && s.curText === null) {
        if (s.entry.replace('-', '').replace(/\.$/, '') === '0') return;   // 0 没有正负
        s.entry = s.entry.startsWith('-') ? s.entry.slice(1) : '-' + s.entry;
        return;
      }
      unary('negate');
    }
    function percent() {
      if (s.err) return;
      commit();
      leaveEq();
      const x = s.val, seq = s.tokens.slice(levelStart()), last = seq[seq.length - 1];
      let r = 0;
      if (last && last.t === 'op') {
        if (last.o === '+' || last.o === '-') {
          // a + b%：b% 是 a 的百分之 b
          let base;
          try { base = evalSeq(seq.slice(0, -1)); } catch (e) { base = 0; }
          r = tidy(base * x / 100);
        } else r = tidy(x / 100);
      }
      s.val = r; s.curText = fmtNum(r); s.opFresh = false;
    }
    // ---- 记忆
    function memory(m) {
      if (s.err) return;
      const x = cur();
      if (m === 'MS') { s.mem.unshift(x); s.mem = s.mem.slice(0, 20); commit(); s.opFresh = false; }
      else if (m === 'M+') { if (s.mem.length) s.mem[0] = tidy(s.mem[0] + x); else s.mem.unshift(x); commit(); s.opFresh = false; }
      else if (m === 'M-') { if (s.mem.length) s.mem[0] = tidy(s.mem[0] - x); else s.mem.unshift(-x); commit(); s.opFresh = false; }
      else if (m === 'MC') s.mem = [];
      else if (m === 'MR') recall(0);
    }
    function recall(i) {
      if (s.err || i >= s.mem.length) return;
      leaveEq();
      s.val = s.mem[i]; s.entry = null; s.curText = null; s.opFresh = false;
    }
    function memDelete(i) { s.mem.splice(i, 1); }
    // 记忆列表里单独一条的 M+ / M-（加上 / 减去当前显示的数）
    function memOp(i, kind) {
      if (s.err || i >= s.mem.length) return;
      const x = cur();
      s.mem[i] = tidy(kind === '+' ? s.mem[i] + x : s.mem[i] - x);
      commit(); s.opFresh = false;
    }
    // 粘贴一个数：像调出记忆一样直接换掉当前显示的数
    function paste(x) {
      if (!isFinite(x)) return false;
      if (s.err) clearAll();
      leaveEq();
      s.val = tidy(x); s.entry = null; s.curText = null; s.opFresh = false;
      return true;
    }

    function press(k) {
      if (/^\d$/.test(k)) digit(k);
      else if (k === '.') dot();
      else if (k === '⌫') back();
      else if (k === 'CE') ce();
      else if (k === 'C') clearAll();
      else if (k === '+' || k === '-' || k === '×' || k === '÷') binop(k);
      else if (k === 'x^y' || k === '^') binop('^');
      else if (k === '(') openParen();
      else if (k === ')') closeParen();
      else if (k === '=') equals();
      else if (k === '10^x') unary('pow10');
      else if (k === '1/x') unary('recip');
      else if (k === '±') negate();
      else if (k === '%') percent();
      else if (['MS', 'M+', 'M-', 'MC', 'MR'].includes(k)) memory(k);
    }
    // 现在应该显示什么
    function view() {
      let expr;
      if (s.err || s.justEq) expr = s.eqExpr;
      else {
        expr = seqText(s.tokens);
        if (s.curText && !s.opFresh) expr += expr === '' || expr.endsWith('(') ? s.curText : ' ' + s.curText;
      }
      const main = s.err ? s.err : s.entry !== null ? fmtEntry(s.entry) : fmtNum(s.val);
      return { expr, main, err: !!s.err, mem: s.mem.slice(), memOn: s.mem.length > 0, paren: s.err || s.justEq ? 0 : openCount() };
    }
    return { press, view, recall, memDelete, memOp, paste, state: () => JSON.parse(JSON.stringify(s)), load: (o) => { clearAll(); Object.assign(s, fresh(), o || {}); } };
  }

  root.ClaudeChanCalcCore = { Calc, fmtNum, fmtEntry };
})(typeof window !== 'undefined' ? window : globalThis);
