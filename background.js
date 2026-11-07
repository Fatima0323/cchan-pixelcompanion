// 后台：系统通知 + 扩展图标角标 + 把 claude.ai 上的状态转播给所有网页
const BADGE = {
  working: { text: '…', color: '#e3692c' },
  confirm: { text: '!', color: '#c0392b' },
  done: { text: '✓', color: '#3d8a4a' },
};

// 内容脚本要能读到 session 存储（只存在内存里，关浏览器就没了）
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});

// ---------------------------------------------------------------- 转播
// 每个 claude.ai 标签页报上来自己的状态；挑"最需要你注意"的那个转给其他网页
const PRIORITY = { angry: 5, confirm: 4, working: 3, done: 2, idle: 1, drowsy: 1, sleep: 1 };
async function getLives() {
  const v = await chrome.storage.session.get({ chanLives: {} });
  return v.chanLives || {};
}
let chain = Promise.resolve();      // 一个一个处理，免得几个标签页同时报状态时互相覆盖
function setLive(tabId, view) {
  chain = chain.then(() => setLiveNow(tabId, view)).catch(() => {});
  return chain;
}
async function setLiveNow(tabId, view) {
  const lives = await getLives();
  if (view) lives[tabId] = Object.assign({}, view, { tabId, ts: Date.now() });
  else delete lives[tabId];
  let best = null;
  for (const l of Object.values(lives)) {
    if (!best || (PRIORITY[l.state] || 0) > (PRIORITY[best.state] || 0) ||
        ((PRIORITY[l.state] || 0) === (PRIORITY[best.state] || 0) && l.ts > best.ts)) best = l;
  }
  const strip = (l) => l && JSON.stringify(Object.assign({}, l, { ts: 0 }));
  const cur = (await chrome.storage.session.get({ chanLive: null })).chanLive;
  if (strip(cur) !== strip(best)) await chrome.storage.session.set({ chanLives: lives, chanLive: best });
  else await chrome.storage.session.set({ chanLives: lives });
  syncPokes(lives);
}

// 标签页在后台时，浏览器会把页面里的定时器放得很慢（最慢一分钟一次）。
// claude.ai 那边在干活/等确认时，后台每秒叫它检查一次，别的网页上才能及时看到"做完啦"。
const pokers = {};
function syncPokes(lives) {
  for (const [id, l] of Object.entries(lives)) {
    const need = l.state === 'working' || l.state === 'confirm' || l.state === 'angry';
    if (need && !pokers[id]) {
      pokers[id] = setInterval(() => {
        chrome.tabs.sendMessage(Number(id), { type: 'tick' }, () => {
          if (chrome.runtime.lastError) { clearInterval(pokers[id]); delete pokers[id]; setLive(Number(id), null); }
        });
      }, 1000);
    } else if (!need && pokers[id]) { clearInterval(pokers[id]); delete pokers[id]; }
  }
  for (const id of Object.keys(pokers)) if (!lives[id]) { clearInterval(pokers[id]); delete pokers[id]; }
}
chrome.tabs.onRemoved.addListener((tabId) => { setLive(tabId, null); });

function focusTab(tabId) {
  chrome.tabs.update(tabId, { active: true }, (tab) => {
    void chrome.runtime.lastError;
    if (tab && tab.windowId != null) chrome.windows.update(tab.windowId, { focused: true });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab && sender.tab.id;
  if (msg.type === 'notify') {
    chrome.notifications.create('claude-chan-' + (tabId || 0) + '-' + Date.now(), {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: msg.title,
      message: msg.message || '',
      priority: 2,
    });
  } else if (msg.type === 'badge' && tabId != null) {
    const b = BADGE[msg.state];
    chrome.action.setBadgeText({ tabId, text: b ? b.text : '' });
    if (b) chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
  } else if (msg.type === 'live' && tabId != null) {
    setLive(tabId, msg.view);
  } else if (msg.type === 'whoami') {
    reply({ tabId });
  } else if (msg.type === 'listClaude') {
    // 右键菜单：列出所有 claude.ai 标签页（最近用过的排前面），带上各自的状态
    chrome.tabs.query({ url: 'https://claude.ai/*' }, async (tabs) => {
      void chrome.runtime.lastError;
      const lives = await getLives();
      tabs = (tabs || []).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      reply({ tabs: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url, current: t.id === tabId, state: lives[t.id] && lives[t.id].state })) });
    });
    return true;
  } else if (msg.type === 'openClaude') {
    const win = sender.tab && sender.tab.windowId;
    chrome.tabs.create(Object.assign({ url: 'https://claude.ai/new', active: true }, win != null ? { windowId: win } : {}));
  } else if (msg.type === 'focusClaude') {
    if (msg.tabId) focusTab(msg.tabId);
    else chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => { if (tabs && tabs[0]) focusTab(tabs[0].id); });
  }
});

// 点击通知 → 跳回对应的 claude.ai 标签页
chrome.notifications.onClicked.addListener((id) => {
  const m = id.match(/^claude-chan-(\d+)-/);
  const tabId = m && Number(m[1]);
  if (tabId) focusTab(tabId);
  chrome.notifications.clear(id);
});
