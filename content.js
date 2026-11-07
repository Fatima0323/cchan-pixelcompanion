// Claude 娘 —— 运行在 AI 聊天页面里（claude.ai、chatgpt.com 或 chat.deepseek.com，设置里三选一），监听 AI 的工作状态
(function () {
  'use strict';
  if (window.__claudeChanLoaded) return;
  window.__claudeChanLoaded = true;

  // ------------------------------------------------------------------ 设置
  const DEFAULTS = window.CLAUDE_CHAN_DEFAULTS;
  let cfg = Object.assign({}, DEFAULTS);
  let confirmRe = new RegExp(DEFAULTS.confirmPattern, 'i');

  // 她盯着哪个 AI：Claude 模式盯 claude.ai，ChatGPT 模式盯 chatgpt.com，DeepSeek 模式盯 chat.deepseek.com（设置里切换，三选一）
  // IS_CLAUDE = "这个页面就是她要盯的那个 AI 聊天站"；其他网页上的她只是"转播"，状态从后台同步过来
  const SITES = window.CLAUDE_CHAN_SITES;
  const site = () => SITES[cfg.site] || SITES.claude;
  const AI = () => site().name;
  const isDS = () => site().id === 'deepseek';
  const isGPT = () => site().id === 'chatgpt';
  const onSite = () => (site().hosts || [site().host]).includes(location.hostname);
  let IS_CLAUDE = false;

  // 页面结构选择器（网站改版时可能需要更新）
  const SELS = {
    claude: {
      streaming: '[data-is-streaming="true"]',
      stopButton: 'button[aria-label*="Stop" i], button[aria-label*="停止"], button[data-testid*="stop" i]',
      assistantMsg: '[data-is-streaming], .font-claude-response, .font-claude-message',
    },
    // ChatGPT：2026 年 9 月改版前后的写法都认（改版后回答没有 data-message-author-role 了，正文在 MarkdownRoot 里）
    chatgpt: {
      streaming: '.result-streaming, [data-is-streaming="true"]',
      stopButton: 'button[data-testid="stop-button"], button[aria-label^="Stop" i], button[aria-label*="停止"], button[aria-label*="中止"]',
      assistantMsg: '[data-message-author-role="assistant"] .markdown, div[class*="MarkdownRoot-"], [data-message-author-role="assistant"]:not(:has(.markdown))',
      composer: '#prompt-textarea, form div.ProseMirror[contenteditable="true"], div[contenteditable="true"][role="textbox"]',
    },
    deepseek: {
      streaming: '[data-is-streaming="true"]',
      stopButton: 'button[aria-label*="Stop" i], button[aria-label*="停止"], [role="button"][aria-label*="Stop" i], [role="button"][aria-label*="停止"]',
      assistantMsg: '.ds-markdown',
    },
  };
  let SEL = SELS.claude;

  // ------------------------------------------------------------------ DOM（Shadow DOM 隔离样式）
  const host = document.createElement('div');
  host.id = 'claude-chan-host';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;right:24px;bottom:16px;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
  <style>
    :host { all: initial; }
    .wrap { pointer-events: none; position: relative; display: flex; flex-direction: column; align-items: flex-end; user-select: none;
      font-family: "Zpix", "Fusion Pixel 12px", "Ark Pixel 12px", "Unifont", ui-monospace, "SFMono-Regular", Menlo, "PingFang SC", "Microsoft YaHei", monospace;
      --cover: #7a3b22; --cover-hi: #9a5534; --cover-lo: #4f2414; --foil: #f3d08a; }
    .wrap[data-state="working"] { --cover: #c4562a; --cover-hi: #e0773f; --cover-lo: #873515; }
    .wrap[data-state="confirm"] { --cover: #b23a33; --cover-hi: #d05a4c; --cover-lo: #7a201c; }
    .wrap[data-state="angry"]   { --cover: #9b1d18; --cover-hi: #c1352a; --cover-lo: #63100c; }
    .wrap[data-state="done"]    { --cover: #4d8a3c; --cover-hi: #6eab55; --cover-lo: #2f5a24; }
    .wrap[data-state="drowsy"], .wrap[data-state="sleep"] { --cover: #456173; --cover-hi: #62808f; --cover-lo: #2a3e4b; --foil: #d8e2ea; }

    /* ---- 对话框：一本合上的书（端视），书身用像素画在背景 canvas 上 ---- */
    .bubble { position: relative; max-width: 270px; min-width: 150px; color: #3a2418;
      margin: 0 10px calc(14px - var(--headroom, 0px)) 0; transition: margin-bottom .35s ease, opacity .2s;
      padding: 0 20px 19px 28px; font-size: 12px; line-height: 1.6; word-break: break-word; pointer-events: auto; }
    .wrap[data-state="working"] .bubble { margin-bottom: 4px; }   /* 工作时抬起来，给 token 让路 */
    .bookbg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; pointer-events: none; }
    .tag { position: relative; display: block; height: 16px; color: var(--foil); font-size: 11px; line-height: 17px; letter-spacing: 3px;
      text-shadow: 1px 1px 0 var(--cover-lo); white-space: nowrap; overflow: hidden; }
    .text { position: relative; display: block; padding: 7px 0 5px; white-space: pre-wrap; }
    .ribbon { position: absolute; right: 40px; bottom: -11px; width: 9px; height: 18px; background: #e3692c;
      box-shadow: inset -2px 0 0 #b84d1c; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%); }
    .live { color: #5a3a2c; }
    .live::after { content: "▌"; color: #e3692c; animation: caret 1s steps(1) infinite; }
    @keyframes caret { 50% { opacity: 0; } }
    .wrap[data-state="confirm"] .bubble { animation: nudge 1.1s steps(1) infinite; }
    .wrap[data-state="angry"] .bubble { animation: shake .45s steps(1) infinite; }
    @keyframes nudge { 0%, 70% { transform: none; } 80% { transform: translateY(-2px); } 90% { transform: translateY(0); } }
    @keyframes shake { 0% { transform: translateX(0); } 25% { transform: translateX(-2px); } 50% { transform: translateX(2px); } 75% { transform: translateX(-1px); } }
    .wrap[data-state="sleep"] .bubble { opacity: .78; }
    .bubble.hidden { display: none; }

    .stage { position: relative; }
    canvas { display: block; image-rendering: pixelated; pointer-events: none; }
    .hit { position: absolute; cursor: grab; pointer-events: auto; }
    .hit:active { cursor: grabbing; }

    .fx { position: absolute; pointer-events: none; image-rendering: pixelated; z-index: 1; }
    .bubble { transition: margin-bottom .35s ease, opacity .25s; }
    .wrap.anim .bubble { opacity: 0; pointer-events: none; }

    /* ---- 右键菜单：一张小书签卡片 ---- */
    .menu { position: fixed; display: none; pointer-events: auto; min-width: 176px; z-index: 2; font-size: 12px; line-height: 1.5; user-select: none;
      font-family: "Zpix", "Fusion Pixel 12px", "Ark Pixel 12px", "Unifont", ui-monospace, "SFMono-Regular", Menlo, "PingFang SC", "Microsoft YaHei", monospace;
      background: #fbf3e2; color: #3a2418; border: 2px solid #4f2414; box-shadow: 3px 3px 0 rgba(79, 36, 20, .35); }
    .menu.open { display: block; }
    .menu .head { background: #7a3b22; color: #f3d08a; font-size: 11px; letter-spacing: 3px; padding: 2px 10px 3px; text-shadow: 1px 1px 0 #4f2414; }
    .mi { position: relative; display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 10px; cursor: pointer; white-space: nowrap; }
    .mi:hover, .mi.hot { background: #f6dcc2; }
    .mi.off { color: #a58e7c; cursor: default; }
    .mi.off:hover { background: none; }
    .mi .ico { width: 14px; text-align: center; color: #c4562a; }
    .mi .lab { flex: 1; overflow: hidden; text-overflow: ellipsis; max-width: 230px; }
    .mi .hint { color: #a07a62; font-size: 11px; }
    .mi .arrow { color: #c4562a; }
    .sub { position: absolute; top: -2px; display: none; min-width: 210px; background: #fbf3e2; border: 2px solid #4f2414; box-shadow: 3px 3px 0 rgba(79, 36, 20, .35); }
    .sub.left { right: 100%; } .sub.right { left: 100%; }
    .mi.hot > .sub { display: block; }
    .sub .tip { padding: 4px 10px; font-size: 11px; color: #a07a62; border-bottom: 1px dashed #e0c9a8; }
    .st { font-size: 10px; padding: 0 4px; color: #fff; }
    /* ---- 特效：引力透镜（在她身后，弯曲网页）+ 黑洞本体（在她前面） ---- */
    .lens { position: fixed; display: none; pointer-events: none; border-radius: 50%; }
    .bhfx { position: fixed; display: none; pointer-events: none; image-rendering: pixelated; }
    /* ---- Spark Typing：聊天框里打字时的火星（spkg = 跳起来的字，spk = 火星） ---- */
    .spk, .spkg { position: fixed; left: 0; top: 0; display: none; pointer-events: none; image-rendering: pixelated; }
    .mi .sw { font-size: 11px; padding: 0 6px; border: 1px solid #4f2414; background: #efe0c6; color: #7a3b22; }
    .mi .sw.on { background: #d97757; color: #fff; }
  </style>
  <svg width="0" height="0" style="position:absolute"><filter id="cc-lens" x="0" y="0" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feImage x="0" y="0" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/>
  </filter></svg>
  <div class="lens"></div>
  <div class="wrap" data-state="idle">
    <div class="bubble"><canvas class="bookbg"></canvas><span class="tag">待机</span><span class="text"></span><div class="ribbon"></div></div>
    <div class="stage">
      <canvas></canvas>
      <canvas class="fx"></canvas>
      <div class="hit"></div>
    </div>
  </div>
  <canvas class="bhfx"></canvas>
  <canvas class="spkg"></canvas><canvas class="spk"></canvas>
  <div class="menu"></div>`;
  const wrap = shadow.querySelector('.wrap');
  const bubble = shadow.querySelector('.bubble');
  const tagEl = shadow.querySelector('.tag');
  const textEl = shadow.querySelector('.text');
  const canvas = shadow.querySelector('.stage canvas');
  const fxCanvas = shadow.querySelector('.stage canvas.fx');
  const bookCanvas = shadow.querySelector('.bookbg');
  const hit = shadow.querySelector('.hit');
  const menu = shadow.querySelector('.menu');
  const sprite = new window.ClaudeChanSprite(canvas);
  const lensEl = shadow.querySelector('.lens');
  const lensFilter = shadow.querySelector('#cc-lens');
  const lensImg = lensFilter.querySelector('feImage');
  const lensDisp = lensFilter.querySelector('feDisplacementMap');
  const bhCanvas = shadow.querySelector('.bhfx');
  // 计算器：所有网页共用一个，别的网页里开着的话这里一加载就跟着开
  let calcCtl = null;
  const calcPanel = () => calcCtl || (calcCtl = window.ClaudeChanCalc.create({ shadow, anchor: () => {
    // 第一次打开时放在她（连同对话框）的左边，不挡住她说的话
    const a = canvas.getBoundingClientRect(), b = bubble.getBoundingClientRect();
    return b.width ? { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), bottom: a.bottom } : a;
  } }));
  calcPanel();

  // ------------------------------------------------------------------ Spark Typing：在 AI 聊天框里打字时迸火星（右键菜单里开关）
  const spkCv = shadow.querySelector('.spk'), spkGl = shadow.querySelector('.spkg');
  let spark = null, sparkKit = null, sparkLastT = 0, sparkWasFast = false, sparkDirty = false, caretStyle = null;
  const sparkActive = () => !!(cfg.sparkTyping && IS_CLAUDE && shouldShow());
  // 打字的地方是不是聊天框：DeepSeek 是 textarea，Claude 和 ChatGPT 是可编辑的 div（老版 ChatGPT 是 textarea）
  function composerOf(t) {
    if (!t || !t.closest || host.contains(t)) return null;
    if (isDS()) return t.tagName === 'TEXTAREA' ? t : null;
    if (isGPT() && t.tagName === 'TEXTAREA') return t.id === 'prompt-textarea' || t.closest('form') ? t : null;   // 老版 ChatGPT 是 textarea
    return t.closest('[contenteditable="true"]');
  }
  const countOf = (el) => [...(el.tagName === 'TEXTAREA' ? el.value : el.innerText).replace(/\s/g, '')].length;
  // 光标颜色：平时橙色，打得飞快时紫色
  function sparkCaret(on, fast) {
    if (!on) { if (caretStyle) { caretStyle.remove(); caretStyle = null; } return; }
    if (!caretStyle) { caretStyle = document.createElement('style'); caretStyle.id = 'claude-chan-spark-caret'; (document.head || document.documentElement).appendChild(caretStyle); }
    const target = isDS() ? 'textarea' : isGPT() ? `${SELS.chatgpt.composer}, [contenteditable="true"]` : '[contenteditable="true"]';
    caretStyle.textContent = `${target} { caret-color: ${fast ? '#8f55ff' : '#d97757'} !important; }`;
  }
  function sparkSync() {
    const on = sparkActive();
    sparkCaret(on, false); sparkWasFast = false;
    spkCv.style.display = spkGl.style.display = on ? 'block' : 'none';
    if (on && !spark) {
      spark = new window.ClaudeChanSparkTyping.Sparks(spkCv, spkGl);
      spark.onSound = (kind, info) => {
        if (!cfg.sparkSound) return;          // 打字机声音默认关，在设置里打开
        try {
          if (!sparkKit) sparkKit = window.ClaudeChanSparkTyping.SoundKit(audio());
          sparkKit.play(kind, info, (cfg.volume == null ? 0.6 : cfg.volume) / 0.6);
        } catch (e) {}
      };
    } else if (!on && spark) {
      spark.clear(); spark = null;
      spkCv.width = spkCv.height = spkGl.width = spkGl.height = 0;     // 关掉就把画布的内存也还回去
    }
  }
  window.addEventListener('resize', () => { if (spark) spark.resize(); });
  document.addEventListener('input', (e) => {
    if (!spark || !sparkActive()) return;
    const el = composerOf(e.target); if (!el) return;
    const it = e.inputType || '';
    if (e.isComposing || it === 'insertCompositionText') return;     // 输入法还在拼：等上屏再说
    spark.count = countOf(el);
    if (it.startsWith('delete')) spark.deleted(el);
    else if (it === 'insertFromPaste' || it === 'insertFromDrop') spark.typed(el, '··', true);
    else if (it.startsWith('insert') && it !== 'insertParagraph' && it !== 'insertLineBreak') spark.typed(el, e.data || ' ');
    sparkDirty = true;
  }, true);
  // 中文输入法：一个词上屏 = 一次
  document.addEventListener('compositionend', (e) => {
    if (!spark || !sparkActive() || !e.data) return;
    const el = composerOf(e.target); if (!el) return;
    setTimeout(() => { if (spark) { spark.count = countOf(el); spark.typed(el, e.data); sparkDirty = true; } }, 0);
  }, true);
  // 回车发送：大一点的爆发
  document.addEventListener('keydown', (e) => {
    if (!spark || !sparkActive() || e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    const el = composerOf(e.target); if (!el || !countOf(el)) return;
    const c = window.ClaudeChanSparkTyping.caretOf(el);
    if (c) { spark.count = countOf(el); spark.sent(c.x, c.y + c.h / 2); sparkDirty = true; }
  }, true);

  const shouldShow = () => cfg.enabled && (IS_CLAUDE || cfg.everywhere);
  function mount() {
    if (!shouldShow()) { if (host.isConnected) host.remove(); return; }
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
  }

  // ------------------------------------------------------------------ 声音
  let actx = null;
  function audio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  // 浏览器要求用户先和页面交互过才能出声：第一次点击/按键时解锁
  const unlock = () => { try { audio(); } catch (e) {} };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true });

  const bank = new window.ClaudeChanSounds.SoundBank(audio);
  // 预渲染全部音色，第一次播放时不用等（只在 AI 聊天页上做，见 setHostMode；其他网页用到时再合成）

  function playCat(cat) {
    if (!cfg.sound) return;
    if (cat === 'confirm' && !cfg.confirmSound) return;
    if (cat === 'start' && !cfg.startSound) return;
    bank.play(cat, (cfg.soundPools || {})[cat], cfg.volume).catch((e) => console.warn('[Claude娘] 播放失败', e));
  }
  const playDing = () => playCat('done');
  const playAttention = () => playCat('confirm');

  async function loadCustomSound(b64) {
    bank.override.done = null;
    if (!b64) return;
    try {
      const bin = atob(b64.split(',').pop());
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      bank.override.done = await audio().decodeAudioData(buf.buffer);
    } catch (e) {
      console.warn('[Claude娘] 自定义提示音解码失败', e);
    }
  }

  // ------------------------------------------------------------------ 自定义形象
  async function loadCustomSprites(map) {
    const out = {};
    for (const [state, v] of Object.entries(map || {})) {
      if (!v || !v.data) continue;
      try {
        out[state] = { bitmap: await createImageBitmap(dataURLToBlob(v.data)), frames: v.frames || 1, fps: v.fps || 6 };
      } catch (e) { console.warn('[Claude娘] 形象图加载失败', state, e); }
    }
    sprite.setCustom(out);
  }
  function dataURLToBlob(d) {
    const [head, b64] = d.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime });
  }

  // ------------------------------------------------------------------ 检测 Claude 状态
  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  }

  function isWorking() {
    if (isDS()) return dsWorking();
    if (isGPT()) { for (const el of document.querySelectorAll(SEL.streaming)) if (visible(el)) return true; }   // ChatGPT 页面里有一份看不见的拷贝
    else if (document.querySelector(SEL.streaming)) return true;
    const stops = document.querySelectorAll(SEL.stopButton);
    for (const b of stops) {
      if (!visible(b)) continue;
      if (isGPT() && /dictat|voice|record|听写|语音|录音/i.test(b.getAttribute('aria-label') || '')) continue;   // ChatGPT 的"停止听写 / 语音"不算在回答
      return true;
    }
    return false;
  }

  // ---- DeepSeek：网页版只有对话（没有工具 / 权限确认），所以只判断"在不在回答"
  // 1) 输入框旁边的发送键：空输入框时平常是灰的（aria-disabled="true"）；正在回答时它变成"停止"键，是亮的
  //    —— 必须先亲眼看到过它变灰，才相信这条线索（免得认错按钮，一直以为在工作）
  // 2) 兜底：最新一条回答的字数在不停地变（连续变了好几次），就算在工作
  let dsSendSeenOff = false, dsKey = '', dsKeyPath = '', dsChanges = [], dsOn = false, dsLastChange = 0;
  function dsSendButton() {
    const ta = document.querySelector('textarea');
    if (!ta || host.contains(ta)) return null;
    let box = ta.parentElement;
    for (let i = 0; i < 7 && box; i++, box = box.parentElement) {
      const btns = [...box.querySelectorAll('[role="button"], button')].filter((b) => b.querySelector('svg') && visible(b));
      if (btns.length) return { ta, btn: btns[btns.length - 1] };
    }
    return null;
  }
  function dsWorking() {
    const now = Date.now();
    for (const b of document.querySelectorAll(SEL.stopButton)) if (visible(b) && !host.contains(b)) return true;
    const sb = dsSendButton();
    if (sb && !sb.ta.value.trim()) {
      const off = sb.btn.getAttribute('aria-disabled') === 'true' || sb.btn.disabled;
      if (off) dsSendSeenOff = true;
      else if (dsSendSeenOff) return true;
    }
    const all = document.querySelectorAll(SEL.assistantMsg);
    const key = all.length + ':' + (all.length ? (all[all.length - 1].textContent || '').length : 0);
    if (dsKeyPath !== location.pathname) { dsKeyPath = location.pathname; dsKey = key; dsChanges = []; dsOn = false; return false; }
    if (key !== dsKey) { dsKey = key; dsChanges.push(now); dsLastChange = now; }
    dsChanges = dsChanges.filter((t) => now - t < 3000);
    if (!dsOn && dsChanges.length >= 3) dsOn = true;      // 连续冒字才算（你自己发出去那一句只会变一次）
    if (dsOn && now - dsLastChange > 2000) dsOn = false;
    return dsOn;
  }

  // 只在对话页里找"等你确认 / 等你选"：设置页、账号页这些地方的单选和按钮不算
  const CONVO_PATH = /^\/(chat|new|code|task)(\/|$)/;
  // ChatGPT：首页 / 就是新对话，/c/xxx 是对话，/g/... 是 GPT 或项目里的对话（设置是弹窗，下面的弹窗规则会排除）
  const GPT_CONVO_PATH = /^\/($|c\/|g\/|share\/)/;
  const inConvoPage = () => (isGPT() ? GPT_CONVO_PATH : CONVO_PATH).test(location.pathname);
  // 弹窗、下拉菜单、浮层（设置弹窗、模型选择、风格选择……）里的选项也不算 —— 只认对话内容里的
  const OVERLAY_SEL = 'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-radix-popper-content-wrapper], [data-radix-popover-content], [data-radix-menu-content], [data-radix-select-content]';
  // 浮层通常被挂到 <body> 最外层（和聊天界面并列），所以还要求：和输入框在同一个大容器里
  function inOverlay(el) {
    if (el.closest(OVERLAY_SEL)) return true;
    if (isGPT()) return false;      // ChatGPT 的弹窗 / 菜单都带 role="dialog" 或 Radix 标记，上面已经认出来了；它的输入框不一定和对话在同一个大容器里
    const ed = document.querySelector('[contenteditable="true"]');
    if (!ed) return false;
    let root = ed; while (root.parentElement && root.parentElement !== document.body) root = root.parentElement;
    return !root.contains(el);
  }
  // ChatGPT agent：做有后果的操作前会停下来等你"确认"，要登录时会请你"接管浏览器"；连接器 / 工具调用也会问"允许吗"
  const GPT_CONFIRM_RE = /^(confirm|确认|approve|批准|allow|允许|always allow|始终允许|deny|拒绝|take over|take over browser|take control|接管|接管浏览器|继续任务|resume)$/i;
  function findConfirm() {
    if (isDS() || !inConvoPage()) return null;           // DeepSeek 网页版没有需要确认的操作
    const hits = [];
    const nodes = document.querySelectorAll('button, [role="button"]');
    for (const b of nodes) {
      if (host.contains(b) || inChrome(b)) continue;
      const label = (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
      if (!label || label.length > 30) continue;
      const hit = confirmRe.test(label) || (isGPT() && GPT_CONFIRM_RE.test(label));
      if (hit && visible(b) && !(isGPT() && inOverlay(b))) hits.push(b);   // ChatGPT 的弹窗（删除对话、设置……）里的"确认"不算
    }
    if (cfg.confirmSelector) {
      try {
        for (const el of document.querySelectorAll(cfg.confirmSelector)) if (visible(el) && !host.contains(el)) hits.push(el);
      } catch (e) { /* 选择器写错了，忽略 */ }
    }
    if (!hits.length) return null;
    // 找按钮所在的提示区域，取一段说明文字
    const btn = hits[0];
    let box = btn.parentElement;
    if (isGPT()) {
      // ChatGPT agent 的确认卡片很短：往外找到第一层"除了按钮还有一句话"的容器就停
      const words = (el) => { let t = el.innerText || ''; el.querySelectorAll('button, [role="button"]').forEach((x) => { t = t.replace((x.innerText || '').trim(), ''); }); return cleanText(t); };
      for (let i = 0; i < 4 && box && box.parentElement; i++) { if (words(box).length >= 4) break; box = box.parentElement; }
      return { el: btn, text: words(box).slice(0, 90) };
    }
    for (let i = 0; i < 4 && box && box.parentElement; i++) {
      if ((box.innerText || '').trim().length > 40) break;
      box = box.parentElement;
    }
    let ctxText = (box && box.innerText) || '';
    hits.forEach((h) => { ctxText = ctxText.replace((h.innerText || '').trim(), ''); });
    ctxText = cleanText(ctxText).slice(0, 90);
    return { el: btn, text: ctxText };
  }

  // Claude 给出几个选项、等你选（问答卡片 / 单选 / 多选），也算"需要你确认"
  const SUBMIT_RE = /^(submit|提交|确定|确认|confirm|下一步|next|跳过|skip|send answers?|提交答案)$/i;
  // 翻页 / 步骤导航按钮（"1 2 3 4 5"、"上一步"、"查看所有步骤"）不是选项 —— 分步教程卡片里全是这种
  const NAV_RE = /^(\d{1,2}|上一步|上一页|下一页|返回|previous|prev|back|查看所有步骤|查看全部|全部步骤|view all( steps)?|show all( steps)?|all steps)$/i;
  const labelOf = (el) => cleanText(el.innerText || el.getAttribute('aria-label') || el.value || '');
  function shown(el) {                       // 单选框本体常常是隐藏的，看它的 label / 外层是否可见
    if (visible(el)) return true;
    const lab = el.closest('label') || el.parentElement;
    return !!lab && visible(lab);
  }
  // 按钮里的图标字符（图标字体 / 特殊符号）在像素字体里会变成"□"，显示前先去掉
  const cleanText = (t) => (t || '')
    .replace(/[\uE000-\uF8FF\uFFFD\uFE0F\u200B-\u200D\u2190-\u21FF\u2300-\u23FF\u25A0-\u25FF\u2600-\u27BF\u2B00-\u2BFF]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ').trim();
  const clip = (q) => (q.length > 60 ? q.slice(0, 60) + '…' : q);
  // 找问题本身那句话：不能是任何按钮 / 选项上的字（比如"跳过"）
  function questionText(box) {
    let node = box;
    for (let i = 0; i < 4 && node && node !== document.body; i++, node = node.parentElement) {
      if (i > 0 && node.querySelector('[contenteditable="true"]')) break;
      const btns = new Set([...node.querySelectorAll('button, [role="button"], label, [role="radio"], [role="option"], [role="checkbox"]')]
        .map((b) => cleanText(labelOf(b))));
      const onlyButtons = (l) => { let r = l; for (const b of btns) if (b) r = r.split(b).join(''); return r.replace(/\s/g, '').length < 2; };   // 几个按钮挤在一行也不算
      const lines = (node.innerText || '').split('\n').map(cleanText).filter((l) => l.length >= 2 && !onlyButtons(l) && !SUBMIT_RE.test(l));
      // 卡片里面：第一句不是按钮的话就是问题；往外找时只认问句，免得抓到前面聊天的内容
      const q = i === 0 ? (lines.find((l) => /[?？]$/.test(l)) || lines[0]) : lines.reverse().find((l) => /[?？]$/.test(l));
      if (q) return clip(q);
    }
    return '';
  }

  // 页面框架里的开关（顶栏的"聊天 / 代码"切换、侧栏、菜单、标签页）不算 —— 只看对话内容里的选项
  const CHROME_SEL = 'header, nav, aside, [role="toolbar"], [role="tablist"], [role="menu"], [role="menubar"], [role="navigation"], [role="banner"]';
  const inChrome = (el) => !!el.closest(CHROME_SEL);
  const hasText = (el) => /[\p{L}\p{N}]/u.test((el.innerText || el.textContent || '').trim());   // 只有图标、没有字的按钮不算选项
  function findChoice() {
    if (isDS() || !inConvoPage()) return null;
    const hits = [];
    // 1) 标准的单选 / 多选 / 列表选项：至少两个"有字"的选项
    for (const g of document.querySelectorAll('[role="radiogroup"], [role="listbox"], fieldset, form, [role="group"]')) {
      if (host.contains(g) || inChrome(g) || inOverlay(g) || g.querySelector('[contenteditable="true"]')) continue;     // 聊天输入框、弹窗不算
      const opts = [...g.querySelectorAll('[role="radio"], [role="option"], [role="checkbox"], [role="menuitemradio"], input[type="radio"], input[type="checkbox"]')]
        .map((o) => (o.tagName === 'INPUT' ? o.closest('label') || o.parentElement : o))
        .filter((o) => o && shown(o) && hasText(o) && !NAV_RE.test(labelOf(o)));
      if (opts.length >= 2) hits.push({ el: opts[0], text: questionText(g), kind: 'choice' });
    }
    // 2) 一张卡片里有好几个"有字"的选项按钮 + 一个"提交 / 确定 / 跳过"
    for (const b of document.querySelectorAll('button, [role="button"]')) {
      if (host.contains(b) || inChrome(b) || inOverlay(b) || !SUBMIT_RE.test(labelOf(b)) || !visible(b)) continue;
      let box = b.parentElement;
      for (let i = 0; i < 5 && box; i++, box = box.parentElement) {
        if (box.querySelector('[contenteditable="true"]') || inChrome(box)) break;
        const opts = [...box.querySelectorAll('button, [role="button"]')].filter((x) => x !== b && !SUBMIT_RE.test(labelOf(x)) && !NAV_RE.test(labelOf(x)) && hasText(x) && visible(x));
        if (opts.length >= 2) { hits.push({ el: opts[0], text: questionText(box), kind: 'choice' }); break; }
      }
    }
    if (!hits.length) return null;
    // 有好几个的话，取页面上最靠下的那个（最新的问题）
    hits.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1));
    return hits[0];
  }

  let lastLen = 0, lastTokenAt = 0;
  // 最后一条回答（ChatGPT 改版后整段对话会在页面里渲染两份，只认看得见的那份）
  function lastAssistantEl() {
    const all = document.querySelectorAll(SEL.assistantMsg);
    if (!isGPT()) return all.length ? all[all.length - 1] : null;
    for (let i = all.length - 1; i >= 0; i--) if (!host.contains(all[i]) && visible(all[i])) return all[i];
    return null;
  }
  function lastAssistantLen() {
    const el = lastAssistantEl();
    return el ? (el.textContent || '').length : 0;
  }

  function lastAssistantText() {
    const el = lastAssistantEl();
    if (!el) return '';
    const txt = (el.innerText || el.textContent || '').trim();
    if (!txt) return '';
    const lines = txt.split('\n').map((s) => s.trim()).filter(Boolean);
    const last = lines[lines.length - 1] || '';
    return last.length > 80 ? '…' + last.slice(-80) : last;
  }

  // 页面报错（只看明确的提示区域，避免误判）
  const ERR_RE = /(something went wrong|an error|error occurred|failed|unable to|try again|rate limit|limit reached|出错|错误|失败|上限|请重试)/i;
  const DS_BUSY_RE = /(服务器繁忙|server is busy)/i;
  function findError() {
    // DeepSeek 的"服务器繁忙，请稍后再试。"是直接写在回答里的 —— 只认刚刚在回答的那一条
    if (isDS() && Date.now() - lastWorkingSeen < 8000) {
      const t = lastAssistantText();
      if (DS_BUSY_RE.test(t)) return t.slice(0, 80);
    }
    // ChatGPT 的"Something went wrong / 生成回复时出错"写在对话里（红字），只认刚刚还在回答时冒出来的
    if (isGPT() && Date.now() - lastWorkingSeen < 8000) {
      for (const el of document.querySelectorAll('.text-token-text-error, [class*="text-error"]')) {
        if (host.contains(el) || !visible(el)) continue;
        const t = cleanText(el.innerText || '');
        if (t && t.length < 300 && ERR_RE.test(t)) return t.slice(0, 80);
      }
    }
    for (const el of document.querySelectorAll('[role="alert"], [data-testid*="error" i]')) {
      if (host.contains(el)) continue;
      const t = (el.innerText || '').trim();
      if (t && t.length < 300 && ERR_RE.test(t) && visible(el)) return t.replace(/\s+/g, ' ').slice(0, 80);
    }
    return null;
  }

  // ------------------------------------------------------------------ 状态机
  // idle 待机 · working 工作 · confirm 需要确认（害羞）· angry 等太久/出错（生气）
  // done 完成（开心）· drowsy 犯困 · sleep 睡觉
  let state = 'idle';
  let lastWorkingSeen = 0, doneAt = 0, lastActivity = Date.now();
  let hadWork = false;
  let confirmInfo = null, confirmSince = 0;
  let angryReason = null, angryAt = 0, errText = '', lastErrText = '';
  let liveText = '';

  // ---- 切换对话：claude.ai 是单页应用，切到别的对话时上一个对话的流式输出从页面上消失了，
  //      但它其实还在服务器上继续写。所以"页面上看不到在写了"≠"写完了"。
  const ROUTE_SETTLE = 2500;            // 刚切换页面的这段时间，页面还在加载/旧内容还没清掉，不下结论
  const BG_EXPIRE = 30 * 60000;         // 后台对话最多记 30 分钟
  const isConv = (p) => (isGPT() ? /\/c\/[^/]+/ : /\/chat\/[^/]+/).test(p);
  let curPath = location.pathname, routeChangedAt = 0;
  const bgWork = new Map();             // 切走时还在干活的对话 path → 切走的时间

  const IDLE_LINES = ['有什么要我做的吗？', '我在这里看着哦～', '准备好啦。', '今天也一起加油吧！', '书看到一半…你先说～'];
  let idleLine = IDLE_LINES[0];

  function setState(s) {
    if (s === state) return;
    const prev = state;
    state = s;
    if (reaction && (s === 'confirm' || s === 'angry' || s === 'done' || reaction.forConfirm)) reaction = null;   // 确认完了，"就在这一页"的话也收起来
    if (!reaction) wrap.dataset.state = dispState();
    if (s === 'idle') idleLine = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
    if (s === 'working' && prev !== 'confirm' && prev !== 'angry') playCat('start');
    if (s === 'done') {
      doneAt = Date.now();
      playDing();
      notify(`${AI()} 做完啦 ✓`, liveText || '回复已完成');
    }
    if (s === 'confirm') {
      playAttention();
      notify(`${AI()} 需要你确认 ！`, (confirmInfo && confirmInfo.text) || '有一步操作在等你点头');
    }
    if (s === 'angry') {
      playAttention();
      if (angryReason === 'timeout') notify(`${AI()} 等你确认好久了 💢`, (confirmInfo && confirmInfo.text) || '快回来点一下');
      else notify(`${AI()} 出错了`, errText || '页面上出现了错误提示');
    }
    badge(s);
    paintBubble();
    publish(true);
  }

  const TAGS = { idle: '待机', working: '工作中', confirm: '需要确认', angry: '生气', done: '完成', drowsy: '犯困', sleep: '睡觉' };
  // 书本背景：尺寸或颜色变了才重画
  let bookKey = '';
  function drawBook() {
    if (bubble.classList.contains('hidden')) return;
    const w = bubble.offsetWidth, h = bubble.offsetHeight;
    if (!w || !h) return;
    const cs = getComputedStyle(wrap);
    const colors = { cover: cs.getPropertyValue('--cover'), hi: cs.getPropertyValue('--cover-hi'), lo: cs.getPropertyValue('--cover-lo') };
    const key = [w, h, colors.cover, window.devicePixelRatio].join('|');
    if (key === bookKey) return;
    bookKey = key;
    window.ClaudeChanBook.draw(bookCanvas, w, h, colors);
  }
  new ResizeObserver(() => drawBook()).observe(bubble);

  // 当前状态在对话框里显示什么（claude.ai 上用；也原样发给其他网页）
  function view() {
    const ctx = confirmInfo && confirmInfo.text ? confirmInfo.text + '\n' : '';
    const v = { state, tag: state === 'angry' && angryReason === 'error' ? '出错' : TAGS[state], text: '', live: false,
                reason: angryReason || '' };
    if (state === 'working') {
      v.text = liveText || '认真思考中…'; v.live = true;
    } else if (state === 'confirm') {
      v.text = confirmInfo && confirmInfo.kind === 'choice'
        ? '有个问题等你选一下～\n' + ctx + '👉 就在这一页哦'
        : '那个…能帮我确认一下吗？\n' + ctx + '👉 就在这一页哦';
    } else if (state === 'angry') {
      v.text = angryReason === 'error' ? '呜…出错了！\n' + (errText || '') : '哼！等你好久了！\n' + ctx + '👉 就在这一页，快去确认';
    } else if (state === 'done') {
      v.text = '叮～做完啦！' + (liveText ? '\n' + liveText : '');
    } else if (state === 'drowsy') {
      v.text = '呼啊…好困…（有事叫我）';
    } else if (state === 'sleep') {
      v.text = 'zzz…';
    } else {
      v.text = bgWork.size ? '刚才那个对话可能还在后台写…\n切回去我帮你接着盯～' : idleLine;
    }
    return v;
  }

  // ---- 其他网页：显示 claude.ai 那边同步过来的状态
  let mirror = null;            // { state, tag, text, live, reason, tabId }
  let mirrorHoldUntil = 0;
  function mirrorView() {
    if (!mirror) return { tag: '待机', text: `打开 ${site().host}，我就能陪你盯着 ${AI()} 啦～`, live: false };
    const v = Object.assign({}, mirror);
    if (v.state === 'confirm') v.text = v.text.replace('👉 就在这一页哦', '👉 点我跳过去');
    if (v.state === 'angry' && v.reason !== 'error') v.text = v.text.replace('👉 就在这一页，快去确认', '👉 快点我跳过去确认');
    return v;
  }
  function applyMirror(m) {
    if (IS_CLAUDE || Date.now() < mirrorHoldUntil) return;
    const prevText = mirror && mirror.text;
    mirror = m || null;
    const s2 = mirror ? mirror.state : 'idle';
    if (s2 === 'working' && mirror.text !== prevText) sprite.emitToken();     // 那边在出字 → 这边也冒 token
    state = s2;
    if (!reaction) wrap.dataset.state = s2;
    paintBubble();
  }

  // claude.ai 页面：自己这边闲着，但别的 claude.ai 标签页在等你确认 → 也显示出来，点她直接跳过去
  let myTabId = null, foreign = null;
  const foreignOn = () => IS_CLAUDE && foreign && foreign.tabId !== myTabId &&
    (foreign.state === 'confirm' || (foreign.state === 'angry' && foreign.reason !== 'error')) &&
    !['working', 'confirm', 'angry'].includes(state);
  const dispState = () => (foreignOn() ? foreign.state : state);
  function applyForeign(m) {
    foreign = m || null;
    if (!reaction) wrap.dataset.state = dispState();
    paintBubble();
  }

  function loadMirror() {
    try { chrome.storage.session.get({ chanLive: null }, (v) => { void chrome.runtime.lastError; applyMirror(v && v.chanLive); }); } catch (e) {}
  }

  // ---- claude.ai：状态变了就告诉后台（后台再转给所有网页）
  let lastPub = '', lastPubAt = 0;
  function publish(force) {
    if (!IS_CLAUDE) return;
    const v = view();
    const key = JSON.stringify(v);
    const now = Date.now();
    if (!force && key === lastPub && now - lastPubAt < 5000) return;
    lastPub = key; lastPubAt = now;
    try { chrome.runtime.sendMessage({ type: 'live', view: v }); } catch (e) {}
  }

  function paintBubble() {
    requestAnimationFrame(drawBook);
    if (reaction) {
      tagEl.textContent = reaction.tag;
      textEl.className = 'text';
      textEl.textContent = reaction.text;
      bubble.classList.toggle('hidden', !cfg.showBubble);
      return;
    }
    const v = !IS_CLAUDE ? mirrorView() : foreignOn()
      ? Object.assign({}, foreign, { text: foreign.text.replace('👉 就在这一页哦', '👉 点我跳过去').replace('👉 就在这一页，快去确认', '👉 快点我跳过去确认') })
      : view();
    tagEl.textContent = v.tag;
    textEl.className = v.live ? 'text live' : 'text';
    textEl.textContent = v.text;
    const urgent = dispState() === 'confirm' || dispState() === 'angry';
    bubble.classList.toggle('hidden', !cfg.showBubble && !urgent);   // 关掉后，需要确认时仍会出现
  }

  function onRoute(now) {
    const path = location.pathname;
    if (path === curPath) return;
    const prev = curPath;
    curPath = path;
    const busy = hadWork || state === 'working';
    // 新对话发出第一句后，地址会从 /new 变成 /chat/xxx —— 这是同一个对话，照常继续
    if (busy && !isConv(prev) && isConv(path)) return;
    routeChangedAt = now;
    if (busy) bgWork.set(prev, now);   // 真的切到了别的对话：把上一个记成"后台进行中"，不要报完成
    hadWork = false; lastLen = 0; liveText = '';
    if (state === 'working' || state === 'done') setState('idle'); else paintBubble();
  }

  function tick() {
    if (!cfg.enabled) return;
    mount();
    const now = Date.now();
    onRoute(now);
    for (const [p, t] of bgWork) if (now - t > BG_EXPIRE) bgWork.delete(p);
    // 刚切换完页面：旧对话的内容可能还残留在 DOM 里，等页面稳定了再判断，免得误报
    if (now - routeChangedAt < ROUTE_SETTLE) return;
    const working = isWorking();
    // 切回了一个之前在后台干活的对话
    if (bgWork.has(curPath)) {
      if (working) {
        bgWork.delete(curPath);                          // 还在写 → 下面照常进入工作状态，写完时正常叮一声
      } else if (lastAssistantLen() > 0) {               // 回来时已经写完了 → 现在才报完成
        bgWork.delete(curPath);
        const t = lastAssistantText();
        if (t) liveText = t;
        setState('done');
        return;
      }
      // 页面内容还没加载出来 → 继续等
    }
    if (working) {
      lastWorkingSeen = now;
      hadWork = true;
      lastActivity = now;
      const t = lastAssistantText();
      if (t) liveText = t;
      const len = lastAssistantLen();
      // 输出变长 → 冒 token（越快冒越多）；在跑工具没出字时也偶尔冒一个
      if (len > lastLen + 3) { sprite.emitToken(); if (len - lastLen > 60) setTimeout(() => sprite.emitToken(), 180); lastTokenAt = now; }
      lastLen = len;
    }
    confirmInfo = findConfirm() || findChoice();
    const err = findError();
    if (!err) lastErrText = '';

    if (confirmInfo) {
      lastActivity = now;
      if (!confirmSince) confirmSince = now;
      if (now - confirmSince > cfg.confirmAngrySec * 1000) { angryReason = 'timeout'; setState('angry'); }
      else setState('confirm');
    } else {
      confirmSince = 0;
      if (err && err !== lastErrText) {
        lastErrText = err; errText = err; angryReason = 'error'; angryAt = now;
        hadWork = false; lastActivity = now;
        if (state === 'angry') paintBubble(); else setState('angry');
      } else if (state === 'angry' && angryReason === 'error' && now - angryAt < cfg.errorHoldSec * 1000) {
        // 生气一会儿
      } else if (working || (hadWork && now - lastWorkingSeen < 1500)) {
        // 1.5 秒宽限：工具调用之间的短暂停顿不算结束
        setState('working');
      } else if (hadWork) {
        hadWork = false;
        const t = lastAssistantText();
        if (t) liveText = t;
        setState('done');
      } else if (state === 'done' && now - doneAt > cfg.doneHoldSec * 1000) {
        setState('idle');
      } else if (state === 'idle' && now - lastActivity > cfg.drowsyAfterSec * 1000) {
        setState('drowsy');
      } else if (state === 'drowsy' && now - lastActivity > cfg.sleepAfterMin * 60000) {
        setState('sleep');
      } else if (state === 'confirm' || state === 'working' || state === 'angry') {
        angryReason = null;
        setState('idle');
      }
    }
    if (state === 'working') paintBubble();
    publish(false);
  }

  // ------------------------------------------------------------------ 动画循环
  let rafId = 0;
  function frame(t) {
    if (reaction && Date.now() > reaction.until) {
      reaction = null;
      wrap.dataset.state = dispState();
      paintBubble();
    }
    // 跑工具、没在出字时也偶尔冒一个 token
    if (state === 'working' && !reaction && Date.now() - lastTokenAt > 900) { sprite.emitToken(); lastTokenAt = Date.now(); }
    if (stepAnim(performance.now())) sprite.blank();
    else if (fxPlay) sprite.render(fxPlay.art, t, 'none');
    else sprite.render(reaction ? reaction.art : dispState(), t, reaction ? reaction.fx : null);
    stepFx(performance.now());
    if (spark) {
      const now = performance.now(), dt = Math.min(0.05, sparkLastT ? (now - sparkLastT) / 1000 : 0);
      sparkLastT = now;
      spark.step(dt);
      if (spark.busy() || sparkDirty) { spark.draw(); sparkDirty = spark.busy(); }   // 都消失后再画一次，把画布清干净
      if (spark.speed.fast !== sparkWasFast) { sparkWasFast = spark.speed.fast; sparkCaret(true, sparkWasFast); }
    }
    rafId = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ 交互：拖动 / 点击
  let drag = null;
  hit.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || anim) return;    // 只有左键能戳她 / 拖她；右键留给菜单；播小动画时先别打扰（特效期间可以拖着黑洞走）
    const r = host.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom, moved: false };
    hit.setPointerCapture(e.pointerId);
  });
  hit.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const right = Math.max(0, Math.min(window.innerWidth - 60, drag.right - dx));
    const bottom = Math.max(0, Math.min(window.innerHeight - 60, drag.bottom - dy));
    host.style.right = right + 'px';
    host.style.bottom = bottom + 'px';
  });
  hit.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.moved) {
      const pos = { right: parseInt(host.style.right, 10), bottom: parseInt(host.style.bottom, 10) };
      chrome.storage.sync.set({ pos });
    } else if (!fxPlay) {
      onClick();                           // 特效期间只能拖，不换表情
    }
    drag = null;
  });

  // ------------------------------------------------------------------ 小动画（右键菜单里选）
  let anim = null;                         // { def, start, dir, k }
  const animSnd = {};
  function animSound(id) {
    if (animSnd[id]) return animSnd[id];
    const art = window.ClaudeChanAnimArt, url = art && art.sounds && art.sounds[id];
    if (!url) return Promise.resolve(null);
    const bin = atob(url.split(',').pop());
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    animSnd[id] = audio().decodeAudioData(u8.buffer).catch((e) => { console.warn('[Claude娘] 动画音效解码失败', e); return null; });
    return animSnd[id];
  }
  async function playAnim(id) {
    const def = window.ClaudeChanAnims && window.ClaudeChanAnims[id];
    if (!def || anim) return;
    await def.ready();
    const k = Math.max(60, Math.min(400, cfg.height | 0)) / 170;      // 动画按默认 170px 高做的，跟着她的大小缩放
    const dpr = window.devicePixelRatio || 1;
    const f = sprite.foot();
    fxCanvas.width = Math.round(def.size[0] * k * dpr); fxCanvas.height = Math.round(def.size[1] * k * dpr);
    fxCanvas.style.width = def.size[0] * k + 'px'; fxCanvas.style.height = def.size[1] * k + 'px';
    fxCanvas.style.left = (f.x - def.foot[0] * k) + 'px'; fxCanvas.style.top = (f.y - def.foot[1] * k) + 'px';
    const r = canvas.getBoundingClientRect();
    const dir = r.left + f.x > window.innerWidth / 2 ? -1 : 1;          // 她在右半边 → 往左展开；在左半边 → 往右
    anim = { def, start: performance.now(), dir, k, dpr };
    reaction = null; wrap.dataset.state = state;
    wrap.classList.add('anim');
    if (cfg.sound) animSound(id).then((buf) => { if (buf) bank.playBuffer(audio(), buf, cfg.volume); });
  }
  function stepAnim(now) {
    if (!anim) return false;
    const at = (now - anim.start) / 1000;
    const ctx = fxCanvas.getContext('2d');
    if (at > anim.def.duration) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      anim = null; wrap.classList.remove('anim');
      canvas.style.transform = '';
      return false;
    }
    // 有的动画里她会先出现在别的位置，再走回原位：直接挪她的画布（影子一起走）
    if (anim.def.herOffset) {
      const [dx, dy] = anim.def.herOffset(at, anim.dir);
      canvas.style.transform = dx || dy ? `translate(${dx * anim.k}px, ${dy * anim.k}px)` : '';
    }
    const u = anim.k * anim.dpr;
    ctx.setTransform(u, 0, 0, u, 0, 0);
    anim.def.draw(ctx, at, anim.dir);
    const [h0, h1] = anim.def.hideHer;
    return at >= h0 && at < h1;                // true = 这一帧她本人不画
  }

  // ------------------------------------------------------------------ 特效（右键菜单里选）
  // 黑洞：她换成托着黑洞的立绘；黑洞本体画在她前面，引力透镜放在她身后，只弯曲网页内容
  let fxPlay = null;                       // { def, start, k, dpr, art, snd }
  function playFx(id) {
    const def = window.ClaudeChanFx && window.ClaudeChanFx[id];
    if (!def || anim || fxPlay) return;
    const k = Math.max(60, Math.min(400, cfg.height | 0)) / 170;
    const dpr = window.devicePixelRatio || 1;
    const S = def.size * k;
    bhCanvas.width = Math.round(S * dpr); bhCanvas.height = Math.round(S * dpr);
    bhCanvas.style.width = S + 'px'; bhCanvas.style.height = S + 'px';
    const L = def.lens.radius * 2 * k;
    lensEl.style.width = L + 'px'; lensEl.style.height = L + 'px';
    lensFilter.setAttribute('width', L); lensFilter.setAttribute('height', L);
    lensImg.setAttribute('width', L); lensImg.setAttribute('height', L);
    lensImg.setAttribute('href', def.lens.map());
    lensDisp.setAttribute('scale', 0);
    // url(#id) 要等滤镜里的贴图就位后再挂上
    lensEl.style.backdropFilter = 'url(#cc-lens)';
    lensEl.style.display = 'block'; bhCanvas.style.display = 'block';
    fxPlay = { def, start: performance.now(), k, dpr, art: 'blackhole', L };
    reaction = null; wrap.dataset.state = state;
    wrap.classList.add('anim');
    if (cfg.sound) fxPlay.snd = rumble(def.duration);
  }
  function stopFx() {
    if (!fxPlay) return;
    lensEl.style.display = 'none'; lensEl.style.backdropFilter = '';
    bhCanvas.style.display = 'none';
    if (fxPlay.snd) fxPlay.snd();
    fxPlay = null;
    wrap.classList.remove('anim');
    wrap.dataset.state = dispState();
  }
  function stepFx(now) {
    if (!fxPlay) return;
    const { def, k, dpr, L } = fxPlay;
    const at = (now - fxPlay.start) / 1000;
    if (at > def.duration) { stopFx(); return; }
    // 黑洞中心在屏幕上的位置（跟着她走 + 上下浮动）
    const r = canvas.getBoundingClientRect(), hp = sprite.holePos();
    const cx = r.left + hp.x, cy = r.top + hp.y + def.bob(at) * k;
    const S = def.size * k;
    bhCanvas.style.left = (cx - S / 2) + 'px'; bhCanvas.style.top = (cy - S / 2) + 'px';
    lensEl.style.left = (cx - L / 2) + 'px'; lensEl.style.top = (cy - L / 2) + 'px';
    lensDisp.setAttribute('scale', (2 * def.lens.maxOffset * k * def.lensStrength(at)).toFixed(2));
    const ctx = bhCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, bhCanvas.width, bhCanvas.height);
    const u = k * dpr;
    ctx.setTransform(u, 0, 0, u, (S / 2) * dpr, (S / 2) * dpr);
    def.draw(ctx, at);
  }
  // 低沉的引力嗡鸣（现场合成，跟着特效 5 秒淡入淡出）；返回一个"提前停掉"的函数
  function rumble(dur) {
    try {
      const ac = audio(), t0 = ac.currentTime + 0.02, vol = Math.max(0, Math.min(1, cfg.volume));
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, t0);
      out.gain.exponentialRampToValueAtTime(0.32 * vol + 0.0001, t0 + 0.7);
      out.gain.setValueAtTime(0.32 * vol + 0.0001, t0 + dur - 1.0);
      out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      out.connect(ac.destination);
      const nodes = [];
      [[55, 1, 'sine'], [82.5, 0.35, 'sine'], [110, 0.12, 'triangle']].forEach(([f, a, type]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(f * 1.15, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 1.2);
        o.frequency.setValueAtTime(f, t0 + dur - 0.9); o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + dur);
        g.gain.value = a; o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.05); nodes.push(o);
      });
      // 一阵阵的"吸气"风声：带通噪声，频率慢慢往下扫
      const n = ac.createBuffer(1, Math.round(ac.sampleRate * dur), ac.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = n;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(900, t0); bp.frequency.exponentialRampToValueAtTime(180, t0 + dur);
      const ng = ac.createGain(); ng.gain.value = 0.22;
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 0.77; lg.gain.value = 0.12; lfo.connect(lg).connect(ng.gain);
      src.connect(bp).connect(ng).connect(out); src.start(t0); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
      nodes.push(src, lfo);
      return () => { const t = ac.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0.0001, t, 0.08); nodes.forEach((o) => { try { o.stop(t + 0.4); } catch (e) {} }); };
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------------ 右键菜单
  const STATE_COLOR = { working: '#c4562a', confirm: '#b23a33', angry: '#9b1d18', done: '#4d8a3c' };
  const ask = (msg) => new Promise((res) => {
    try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r || null); }); } catch (e) { res(null); }
  });
  function closeMenu() { menu.classList.remove('open'); menu.innerHTML = ''; }
  function mkItem(parent, { ico = '', lab, hint = '', arrow = false, off = false, onPick }) {
    const el = document.createElement('div');
    el.className = 'mi' + (off ? ' off' : '');
    el.innerHTML = '<span class="ico"></span><span class="lab"></span>' + (hint ? '<span class="hint"></span>' : '') + (arrow ? '<span class="arrow">▸</span>' : '');
    el.querySelector('.ico').textContent = ico;
    el.querySelector('.lab').textContent = lab;
    if (hint) el.querySelector('.hint').textContent = hint;
    if (onPick && !off) el.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); onPick(); });
    parent.appendChild(el);
    return el;
  }
  const shortTitle = (t) => {
    t = (t || '').replace(/\s*[-–|]\s*(Claude|DeepSeek|ChatGPT)\s*$/i, '').trim();
    if (!t || /^DeepSeek\b/i.test(t) || /^ChatGPT$/i.test(t)) t = '新对话';
    return t.length > 18 ? t.slice(0, 18) + '…' : t;
  };
  // 小动画列表：[id, 名字, 小字说明]
  const ANIMS = [['logo', 'Claude娘降临', '向日葵 · 化书现身'], ['book', '书页纷飞', '变成书 · 一阵风']];
  const FXS = [['blackhole', '黑洞', '引力透镜 · 5 秒']];
  // 子菜单：鼠标移上去 / 点一下展开；右边放不下就往左弹，下面放不下就往上挪
  function mkSub(parent, tip) {
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.innerHTML = '<div class="tip"></div>';
    sub.querySelector('.tip').textContent = tip;
    parent.appendChild(sub);
    const placeSub = () => {
      sub.style.top = '-2px';
      const pr = parent.getBoundingClientRect();
      sub.classList.remove('left', 'right');
      sub.classList.add(pr.right + sub.offsetWidth + 4 > window.innerWidth ? 'left' : 'right');
      const over = sub.getBoundingClientRect().bottom - (window.innerHeight - 4);
      if (over > 0) sub.style.top = (-2 - over) + 'px';
    };
    const show = (on) => {
      if (on) parent.parentElement.querySelectorAll(':scope > .mi.hot').forEach((m) => m !== parent && m.classList.remove('hot'));
      parent.classList.toggle('hot', on);
      if (on) placeSub();
    };
    parent.addEventListener('mouseenter', () => show(true));
    parent.addEventListener('mouseleave', () => show(false));
    parent.addEventListener('click', (e) => { e.stopPropagation(); show(!parent.classList.contains('hot')); });
    return sub;
  }

  async function openMenu(x, y) {
    const r = await ask({ type: 'listClaude' });
    const tabs = (r && r.tabs) || [];
    menu.innerHTML = '<div class="head">Claude 娘</div>';
    const others = tabs.filter((t) => !t.current);
    if (!tabs.length) {
      // 没开 claude.ai → 新建一个
      mkItem(menu, { ico: '✚', lab: `打开 ${AI()} 聊天页`, hint: '新建', onPick: () => ask({ type: 'openClaude' }) });
    } else if (tabs.length === 1) {
      const t = tabs[0];
      mkItem(menu, t.current
        ? { ico: '➜', lab: `你就在 ${AI()} 页面上哦`, off: true }
        : { ico: '➜', lab: `跳到 ${AI()} 聊天页`, hint: shortTitle(t.title), onPick: () => ask({ type: 'focusClaude', tabId: t.id }) });
    } else {
      // 开了好几个 → 子菜单里选
      const parent = mkItem(menu, { ico: '➜', lab: `跳到 ${AI()} 聊天页`, hint: others.length + ' 个', arrow: true });
      const sub = mkSub(parent, '要去哪一个？');
      tabs.forEach((t) => {
        const it = mkItem(sub, { ico: t.current ? '·' : '❯', lab: shortTitle(t.title), hint: t.current ? '当前' : '', off: t.current,
                                 onPick: () => ask({ type: 'focusClaude', tabId: t.id }) });
        if (t.state && STATE_COLOR[t.state]) {
          const b = document.createElement('span');
          b.className = 'st'; b.style.background = STATE_COLOR[t.state]; b.textContent = TAGS[t.state] || t.state;
          it.insertBefore(b, it.querySelector('.hint') || null);
        }
      });
    }
    // 实用的东西永远放在上面：跳转、计算器，然后才是小动画、特效
    // 第二项：计算器
    const calcOpen = !!(calcCtl && calcCtl.isOpen());
    mkItem(menu, { ico: '▦', lab: calcOpen ? '收起计算器' : '计算器', hint: calcOpen ? '' : '记得上次算到哪', onPick: () => calcPanel().toggle() });
    // 第三项：小动画
    const ap = mkItem(menu, { ico: '✦', lab: '小动画', arrow: true });
    const asub = mkSub(ap, '让她表演一个～');
    ANIMS.forEach(([id, name, desc], i) => mkItem(asub, { ico: String(i + 1), lab: name, hint: desc, onPick: () => playAnim(id) }));
    // 第四项：特效（会影响网页本身的效果）
    const fp = mkItem(menu, { ico: '◉', lab: '特效', arrow: true });
    const fsub = mkSub(fp, '会作用到网页上哦');
    FXS.forEach(([id, name, desc], i) => mkItem(fsub, { ico: String(i + 1), lab: name, hint: desc, onPick: () => playFx(id) }));
    // 第五项：Spark Typing（开关，所有网页同步）
    const sp = mkItem(menu, { ico: '✧', lab: 'Spark Typing', hint: '', onPick: () => { try { chrome.storage.sync.set({ sparkTyping: !cfg.sparkTyping }); } catch (e) {} } });
    const sw = document.createElement('span'); sw.className = 'sw' + (cfg.sparkTyping ? ' on' : ''); sw.textContent = cfg.sparkTyping ? '开' : '关';
    sp.appendChild(sw);
    menu.classList.add('open');
    // 菜单贴着鼠标，碰到屏幕边就往里收
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(4, Math.min(x, window.innerWidth - mw - 4)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, window.innerHeight - mh - 4)) + 'px';
  }
  hit.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();    // 不弹浏览器自己的菜单，也不跳表情
    if (anim || fxPlay) return;
    openMenu(e.clientX, e.clientY);
  });
  // 点别处 / 按 Esc / 滚动 / 切走 → 收起
  window.addEventListener('pointerdown', (e) => {
    if (menu.classList.contains('open') && !e.composedPath().includes(menu)) closeMenu();
  }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); }, true);
  window.addEventListener('blur', closeMenu);
  window.addEventListener('scroll', closeMenu, true);

  // ------------------------------------------------------------------ 戳一戳：表情 + 台词
  // reaction = { art: 'done'|'confirm'|'angry', fx, tag, text, until }
  let reaction = null;
  let pokes = [];
  const LINES = {
    happy: ['嘿嘿，被你发现啦～', '摸摸头？……诶嘿嘿', '今天也辛苦啦！', '要一起看书吗？', '有你陪着真好～', '我会一直在这里的！'],
    shy: ['欸？突、突然戳我干嘛…', '别、别一直盯着我看啦…', '那个…有什么事吗？', '呜…脸好烫…', '你、你再这样我要害羞了…'],
    flustered: ['别、别戳啦…好痒…', '再戳…再戳我就要生气了哦…', '呜呜，你是故意的吧！'],
    angry: ['哼！不理你了！', '我真的生气了！💢', '你很闲是不是！', '再戳就把你的消息吃掉！'],
    workHappy: ['在写了在写了，马上好～', '我在认真干活哦！'],
    workShy: ['嘘——我在专心呢…', '等、等一下下嘛…'],
    workAngry: ['我在工作啦！别捣乱！', '再打扰我就要写错字了！'],
    doneHappy: ['对吧对吧，我很厉害吧！', '下一个任务是什么？交给我！'],
    wakeAngry: ['唔…谁吵我睡觉！', '嗯…？干嘛啦…人家在睡觉…'],
    wakeShy: ['我、我才没睡着！', '欸？我刚刚只是闭眼思考！'],
    drowsyShy: ['啊！我没在偷懒！', '才、才没有在打瞌睡呢！'],
    drowsyHappy: ['呼啊…好啦好啦，醒了～'],
    errorShy: ['呜…又不是我的错…', '我、我再试试看嘛…'],
  };
  const lastLine = {};
  let lastMood = null;
  function line(pool) {
    const list = LINES[pool];
    const opts = list.length > 1 ? list.filter((l) => l !== lastLine[pool]) : list;
    const l = opts[Math.floor(Math.random() * opts.length)];
    lastLine[pool] = l;
    return l;
  }
  const MOOD = {
    happy: { art: 'done', fx: 'heart', tag: '开心' },
    shy: { art: 'confirm', fx: 'drop', tag: '害羞' },
    angry: { art: 'angry', fx: 'angry', tag: '生气' },
  };
  function react(mood, pool) {
    reaction = Object.assign({ text: line(pool), until: Date.now() + 2600, mood }, MOOD[mood]);
    lastMood = mood;
    wrap.dataset.state = mood === 'happy' ? 'done' : mood === 'shy' ? 'confirm' : 'angry';
    if (cfg.sound) bank.playId(mood === 'angry' ? 'marimba' : 'pop', cfg.volume, mood === 'angry' ? 0.35 : 0.3).catch(() => {});
    paintBubble();
  }
  // 开心/害羞二选一，尽量不和上一次一样
  const pickSoft = () => (lastMood === 'happy' ? (Math.random() < 0.7 ? 'shy' : 'happy') : (Math.random() < 0.7 ? 'happy' : 'shy'));

  function onClick() {
    unlock();
    const now = Date.now();
    // 别的标签页在等确认 → 直接跳到那个 claude.ai 聊天页
    if (!IS_CLAUDE && mirror && (state === 'confirm' || (state === 'angry' && mirror.reason !== 'error'))) {
      try { chrome.runtime.sendMessage({ type: 'focusClaude', tabId: mirror.tabId }); } catch (e) {}
      return;
    }
    if (foreignOn()) {
      try { chrome.runtime.sendMessage({ type: 'focusClaude', tabId: foreign.tabId }); } catch (e) {}
      return;
    }
    if ((state === 'confirm' || state === 'angry') && confirmInfo) {
      // 就是这个页面在等你：不用滚，告诉你就在这儿
      reaction = { art: 'confirm', fx: 'drop', tag: TAGS[state], mood: 'shy', until: now + 2600, forConfirm: true,
                   text: state === 'angry' ? '已经在这个页面啦！\n快去确认嘛～' : '已经在这个页面啦～\n问题就在这一页哦' };
      wrap.dataset.state = 'confirm';
      paintBubble();
      return;
    }
    pokes = pokes.filter((p) => now - p < 4000);
    pokes.push(now);
    const n = pokes.length;
    lastActivity = now;
    if (state === 'sleep') {
      Math.random() < 0.6 ? react('angry', 'wakeAngry') : react('shy', 'wakeShy');
      if (IS_CLAUDE) state = 'idle';   // 其他网页上只做反应，状态还是跟着 claude.ai
    } else if (state === 'drowsy') {
      Math.random() < 0.6 ? react('shy', 'drowsyShy') : react('happy', 'drowsyHappy');
      if (IS_CLAUDE) state = 'idle';   // 其他网页上只做反应，状态还是跟着 claude.ai
    } else if (state === 'angry' && angryReason === 'error') {
      angryReason = null;
      react('shy', 'errorShy');
      if (IS_CLAUDE) state = 'idle';   // 其他网页上只做反应，状态还是跟着 claude.ai
    } else if (state === 'working') {
      if (n >= 4) react('angry', 'workAngry');
      else { const m = pickSoft(); react(m, m === 'happy' ? 'workHappy' : 'workShy'); }
    } else {
      if (n >= 5) react('angry', 'angry');
      else if (n >= 3) react('shy', 'flustered');
      else if (state === 'done' && Math.random() < 0.5) react('happy', 'doneHappy');
      else { const m = pickSoft(); react(m, m); }
    }
  }

  // 用户在页面上打字 = 活跃，把"完成/睡觉"切回待机
  window.addEventListener('keydown', (e) => {
    if (!IS_CLAUDE || host.contains(e.target)) return;
    lastActivity = Date.now();
    if (state === 'sleep' || state === 'drowsy' || (state === 'done' && Date.now() - doneAt > 1500)) setState('idle');
  }, true);

  // ------------------------------------------------------------------ 通知 / 角标（交给后台）
  function notify(title, message) {
    if (!cfg.notify) return;
    if (!document.hidden && document.hasFocus()) return; // 你正看着页面就不弹系统通知
    try { chrome.runtime.sendMessage({ type: 'notify', title, message }); } catch (e) {}
  }
  function badge(s) {
    try { chrome.runtime.sendMessage({ type: 'badge', state: s }); } catch (e) {}
  }

  // ------------------------------------------------------------------ 设置加载与同步
  function applyCfg() {
    try { confirmRe = new RegExp(cfg.confirmPattern || DEFAULTS.confirmPattern, 'i'); } catch (e) { confirmRe = new RegExp(DEFAULTS.confirmPattern, 'i'); }
    sprite.setHeight(Math.max(60, Math.min(400, cfg.height | 0)));
    wrap.style.setProperty('--headroom', sprite.headroom() + 'px');
    const hb = sprite.hitBox();
    Object.assign(hit.style, { left: hb.x + 'px', top: hb.y + 'px', width: hb.w + 'px', height: hb.h + 'px' });
    if (cfg.pos) { host.style.right = cfg.pos.right + 'px'; host.style.bottom = cfg.pos.bottom + 'px'; }
    host.style.display = shouldShow() ? '' : 'none';
    mount();
    paintBubble();
    sparkSync();
  }

  chrome.storage.sync.get(DEFAULTS, (v) => { cfg = Object.assign({}, DEFAULTS, v); setHostMode(onSite()); applyCfg(); });
  chrome.storage.local.get({ customSound: null, customSprites: null }, (v) => {
    if (v.customSound) loadCustomSound(v.customSound);
    if (v.customSprites) loadCustomSprites(v.customSprites);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      for (const [k, c] of Object.entries(changes)) cfg[k] = c.newValue === undefined ? DEFAULTS[k] : c.newValue;
      if (changes.site) setHostMode(onSite());
      applyCfg();
    } else if (area === 'local') {
      if (changes.customSound) loadCustomSound(changes.customSound.newValue);
      if (changes.customSprites) loadCustomSprites(changes.customSprites.newValue);
    }
  });

  // 弹窗里的"试一下"按钮和状态查询
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'tick') {          // 后台每秒叫醒一次：标签页在后台时浏览器会把定时器放慢，靠这个保证及时
      if (IS_CLAUDE && Date.now() > testHoldUntil) tick();
      reply({ ok: true });
      return true;
    }
    if (!IS_CLAUDE && msg.type === 'test') {
      unlock();
      if (msg.what === 'ding') playDing();
      else if (msg.what === 'attention') playAttention();
      else if (msg.what === 'startSound') playCat('start');
      else {
        const demo = { working: `正在逐字同步 ${AI()} 的输出…`, confirm: `那个…能帮我确认一下吗？\n${AI()} 想要运行一条命令（演示）\n👉 点我跳回 ${AI()}`,
                       angry: '哼！等你好久了！\n👉 快点我跳回去确认', done: '叮～做完啦！', drowsy: '呼啊…好困…（有事叫我）', sleep: 'zzz…', idle: '准备好啦。' };
        mirrorHoldUntil = 0;
        applyMirror({ state: msg.what, tag: TAGS[msg.what], text: demo[msg.what] || '', live: msg.what === 'working', reason: 'timeout', tabId: null });
        mirrorHoldUntil = Date.now() + 4000;
        setTimeout(() => { mirrorHoldUntil = 0; loadMirror(); }, 4100);
      }
      reply({ ok: true });
      return true;
    }
    if (!IS_CLAUDE && msg.type === 'status') {
      reply({ state, working: false, confirm: false, text: `（这个网页上的她在转播 ${site().host} 的状态）`, site: site().id, host: false, sounds: actx ? actx.state : 'locked' });
      return true;
    }
    if (msg.type === 'test') {
      unlock();
      if (msg.what === 'ding') playDing();
      else if (msg.what === 'attention') playAttention();
      else if (msg.what === 'startSound') playCat('start');
      else {
        hadWork = false;
        if (msg.what === 'working') liveText = `正在逐字同步 ${AI()} 的输出…`;
        if (msg.what === 'confirm' || msg.what === 'angry') confirmInfo = { el: null, text: `${AI()} 想要运行一条命令（演示）` };
        if (msg.what === 'angry') angryReason = 'timeout';
        state = '__test';
        setState(msg.what);
        // 演示状态保持 4 秒（真实检测会接管）
        testHoldUntil = Date.now() + 4000;
      }
      reply({ ok: true });
    } else if (msg.type === 'status') {
      reply({ state, working: isWorking(), confirm: !!(findConfirm() || findChoice()), text: liveText, site: site().id, host: true, sounds: actx ? actx.state : 'locked' });
    }
    return true;
  });

  let testHoldUntil = 0;
  // ---- 两种身份，可以随时切换（设置里换了 Claude / DeepSeek 模式时）：
  //   盯站：这个页面就是她要盯的 AI 聊天站 → 自己检测状态，报给后台
  //   转播：别的网页 → 读后台汇总好的状态，跟着变
  let tickTimer = 0, booted = false;
  function setHostMode(on) {
    if (booted && on === IS_CLAUDE) return;
    const wasHost = booted && IS_CLAUDE, firstBoot = !booted;
    booted = true;
    IS_CLAUDE = on;
    SEL = SELS[site().id] || SELS.claude;
    // 换了身份：之前的状态都不作数了
    hadWork = false; confirmInfo = null; confirmSince = 0; angryReason = null; errText = ''; lastErrText = '';
    liveText = ''; lastLen = 0; bgWork.clear(); mirror = null; foreign = null; reaction = null;
    dsSendSeenOff = false; dsKeyPath = ''; dsOn = false;
    state = 'idle'; lastActivity = Date.now(); curPath = location.pathname;
    routeChangedAt = firstBoot ? 0 : Date.now();      // 中途换模式时，页面上残留的旧内容先别下结论
    if (on) {
      Object.keys(window.ClaudeChanSounds.SOUNDS).forEach((id) => bank.buffer(id));
      if (!tickTimer) tickTimer = setInterval(() => { if (IS_CLAUDE && Date.now() > testHoldUntil) tick(); }, 400);
      try { chrome.runtime.sendMessage({ type: 'whoami' }, (r) => { void chrome.runtime.lastError; myTabId = r && r.tabId; }); } catch (e) {}
      try { chrome.storage.session.get({ chanLive: null }, (v) => { void chrome.runtime.lastError; if (IS_CLAUDE) applyForeign(v && v.chanLive); }); } catch (e) {}
      publish(true);
    } else {
      if (wasHost) {                       // 不再盯这个站了：撤掉它报过的状态和角标
        try { chrome.runtime.sendMessage({ type: 'live', view: null }); } catch (e) {}
        badge('idle');
      }
      loadMirror();
    }
    wrap.dataset.state = dispState();
    paintBubble();
  }
  // 离开 / 关掉这个 AI 聊天页 → 告诉后台，别的网页上不要还挂着它的状态
  window.addEventListener('pagehide', () => { if (IS_CLAUDE) { try { chrome.runtime.sendMessage({ type: 'live', view: null }); } catch (e) {} } });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session' || !changes.chanLive || !booted) return;
    if (IS_CLAUDE) applyForeign(changes.chanLive.newValue); else applyMirror(changes.chanLive.newValue);
  });
  rafId = requestAnimationFrame(frame);
  void rafId;
})();
