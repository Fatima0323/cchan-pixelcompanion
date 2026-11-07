// 弹窗设置页
const DEFAULTS = window.CLAUDE_CHAN_DEFAULTS;
const $ = (id) => document.getElementById(id);
const STATES = [
  ['idle', '待机'], ['working', '工作中'], ['confirm', '需确认'], ['angry', '生气'], ['done', '完成'], ['drowsy', '犯困'], ['sleep', '睡觉'],
];
const BOOL = ['enabled', 'everywhere', 'showBubble', 'sound', 'confirmSound', 'startSound', 'notify'];
const NUM = ['height', 'volume', 'doneHoldSec', 'confirmAngrySec', 'errorHoldSec', 'drowsyAfterSec', 'sleepAfterMin'];
const TXT = ['confirmPattern', 'confirmSelector'];

// ---------------------------------------------------------------- 普通设置
chrome.storage.sync.get(DEFAULTS, (cfg) => {
  BOOL.forEach((k) => { $(k).checked = !!cfg[k]; $(k).onchange = () => save(k, $(k).checked); });
  NUM.forEach((k) => { $(k).value = cfg[k]; $(k).oninput = () => save(k, Number($(k).value)); });
  TXT.forEach((k) => { $(k).value = cfg[k]; $(k).onchange = () => save(k, $(k).value.trim()); });
  pools = Object.assign({}, DEFAULTS.soundPools, cfg.soundPools || {});
  volume = cfg.volume;
  renderPools();
});
$('volume').addEventListener('input', () => { volume = Number($('volume').value); });

// ---------------------------------------------------------------- 提示音分类（弹窗里直接合成试听）
const { SOUNDS, CATEGORIES, SoundBank } = window.ClaudeChanSounds;
let pools = {}, volume = 0.6, actx = null;
const bank = new SoundBank(() => { if (!actx) actx = new AudioContext(); if (actx.state === 'suspended') actx.resume(); return actx; });
function flash(id) {
  const el = document.querySelector(`.chip[data-id="${id}"]`);
  if (!el) return;
  el.classList.add('playing');
  setTimeout(() => el.classList.remove('playing'), 700);
}
function renderPools() {
  const box = $('pools');
  box.innerHTML = '';
  Object.entries(CATEGORIES).forEach(([cat, c]) => {
    const div = document.createElement('div');
    div.className = 'pool';
    div.innerHTML = `<div class="pool-head"><b>${c.name}</b><span class="hint" style="margin:0">${c.desc}</span><button class="rand">🎲 随机一下</button></div><div class="chips"></div>`;
    const chips = div.querySelector('.chips');
    c.ids.forEach((id) => {
      const on = (pools[cat] || []).includes(id);
      const chip = document.createElement('label');
      chip.className = 'chip' + (on ? '' : ' off');
      chip.dataset.id = id;
      chip.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''}><span>${SOUNDS[id].name}</span><button title="试听">▶</button>`;
      chip.querySelector('input').onchange = (e) => {
        let list = (pools[cat] || []).filter((x) => x !== id);
        if (e.target.checked) list.push(id);
        if (!list.length) { e.target.checked = true; alert('每类至少留一个音'); return; }
        pools[cat] = c.ids.filter((x) => list.includes(x));
        chrome.storage.sync.set({ soundPools: pools });
        chip.classList.toggle('off', !e.target.checked);
      };
      chip.querySelector('button').onclick = (e) => { e.preventDefault(); bank.playId(id, volume, c.level); flash(id); };
      chips.appendChild(chip);
    });
    div.querySelector('.rand').onclick = async () => { const id = await bank.play(cat, pools[cat], volume); flash(id); };
    box.appendChild(div);
  });
}
function save(k, v) {
  if (k === 'confirmPattern') { try { new RegExp(v, 'i'); } catch (e) { alert('正则写错了：' + e.message); return; } }
  chrome.storage.sync.set({ [k]: v });
}
$('resetPos').onclick = () => chrome.storage.sync.set({ pos: { right: 24, bottom: 16 } });
$('resetAll').onclick = () => chrome.storage.sync.clear(() => location.reload());

// ---------------------------------------------------------------- 和当前标签页通信
function activeTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => cb(tabs[0]));
}
function sendToTab(msg, cb) {
  activeTab((tab) => {
    if (!tab) { cb && cb(null); return; }
    chrome.tabs.sendMessage(tab.id, msg, (r) => { void chrome.runtime.lastError; cb && cb(r || null); });
  });
}
document.querySelectorAll('[data-test]').forEach((b) => {
  b.onclick = () => sendToTab({ type: 'test', what: b.dataset.test }, (r) => {
    if (!r) $('st').textContent = '请先打开 claude.ai';
  });
});
const NAMES = { idle: '待机', working: '工作中', confirm: '需要确认', angry: '生气', done: '完成', drowsy: '犯困', sleep: '睡觉' };
function poll() {
  sendToTab({ type: 'status' }, (r) => {
    if (!r) { $('st').textContent = '不在 claude.ai'; return; }
    $('st').textContent = NAMES[r.state] || r.state;
    $('status').textContent =
      `状态：${NAMES[r.state] || r.state}\n正在生成：${r.working ? '是' : '否'}\n确认按钮：${r.confirm ? '检测到' : '无'}\n` +
      `声音：${r.sounds === 'running' ? '已就绪' : '未解锁（在页面上点一下即可）'}\n最近一句：${r.text || '—'}`;
  });
}
poll();
setInterval(poll, 1000);

// ---------------------------------------------------------------- 自定义提示音
function readAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
chrome.storage.local.get({ customSound: null, customSoundName: '' }, (v) => {
  $('soundInfo').textContent = v.customSound ? '当前：' + v.customSoundName : '当前：随机';
});
$('soundFile').onchange = async () => {
  const f = $('soundFile').files[0];
  if (!f) return;
  const data = await readAsDataURL(f);
  chrome.storage.local.set({ customSound: data, customSoundName: f.name }, () => {
    $('soundInfo').textContent = '当前：' + f.name;
    setTimeout(() => sendToTab({ type: 'test', what: 'ding' }), 400);
  });
};
$('soundReset').onclick = () => chrome.storage.local.set({ customSound: null, customSoundName: '' }, () => {
  $('soundInfo').textContent = '当前：随机';
});

// ---------------------------------------------------------------- 自定义形象
let sprites = {};
function renderRows() {
  const box = $('spriteRows');
  box.innerHTML = '';
  STATES.forEach(([k, name]) => {
    const s = sprites[k];
    const row = document.createElement('div');
    row.className = 'sprite-row';
    row.innerHTML = `<span class="name">${name}${s ? ' <span class="ok">✓</span>' : ''}</span>
      <input type="file" accept="image/png,image/gif,image/webp,image/jpeg">
      <input type="number" min="1" max="32" title="帧数" value="${s ? s.frames : 1}">
      <input type="number" min="1" max="30" title="每秒帧数" value="${s ? s.fps : 6}">`;
    const [file, frames, fps] = row.querySelectorAll('input');
    file.onchange = async () => {
      if (!file.files[0]) return;
      const data = await prepareImage(file.files[0], $('stripBg').checked);
      sprites[k] = { data, frames: Number(frames.value) || 1, fps: Number(fps.value) || 6 };
      store();
    };
    const upd = () => { if (sprites[k]) { sprites[k].frames = Number(frames.value) || 1; sprites[k].fps = Number(fps.value) || 6; store(); } };
    frames.onchange = upd; fps.onchange = upd;
    box.appendChild(row);
  });
  const th = $('thumbs');
  th.innerHTML = '';
  STATES.forEach(([k, name]) => {
    if (!sprites[k]) return;
    const img = new Image();
    img.src = sprites[k].data;
    img.title = name;
    th.appendChild(img);
  });
}
function store() {
  chrome.storage.local.set({ customSprites: sprites }, renderRows);
}
chrome.storage.local.get({ customSprites: {} }, (v) => { sprites = v.customSprites || {}; renderRows(); });
$('spriteReset').onclick = () => { sprites = {}; store(); };

// 读图 → 可选去白底（从四边做洪水填充，只去掉和边缘连通的白色）→ 限制尺寸 → PNG dataURL
async function prepareImage(file, stripBg) {
  const bmp = await createImageBitmap(file);
  let w = bmp.width, h = bmp.height;
  const MAX = 640;
  const k = Math.min(1, MAX / Math.max(w, h));
  w = Math.round(w * k); h = Math.round(h * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = k < 1;
  ctx.drawImage(bmp, 0, 0, w, h);
  if (stripBg) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const isBg = (i) => d[i + 3] > 0 && d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232;
    const seen = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      const i = p * 4;
      if (!isBg(i) && d[i + 3] !== 0) continue;
      d[i + 3] = 0;
      const x = p % w, y = (p / w) | 0;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - w);
      if (y < h - 1) stack.push(p + w);
    }
    ctx.putImageData(img, 0, 0);
  }
  return c.toDataURL('image/png');
}
