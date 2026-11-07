// 内容脚本与弹窗共用的默认设置
window.CLAUDE_CHAN_DEFAULTS = {
  enabled: true,
  site: 'claude',   // 陪你盯哪个 AI：'claude'（claude.ai）、'deepseek'（chat.deepseek.com）或 'chatgpt'（chatgpt.com），三选一
  everywhere: true, // 在所有网页上显示（关掉 = 只在 claude.ai 上出现）
  sound: true,
  confirmSound: true,
  startSound: true, // Claude 开始工作时轻响一下
  // 每类事件可用的音色（同类随机、不连续重复）；空 = 用该类全部
  soundPools: { done: ['glass', 'piano', 'rise', 'arp', 'kalimba'], confirm: ['softbell', 'breeze', 'hum'], start: ['marimba', 'pop'] },
  volume: 0.6,
  notify: true,
  height: 170,
  showBubble: true,
  // 识别"需要你确认"的按钮文字（正则，不区分大小写）
  confirmPattern: "^(allow|allow once|always allow|allow for this chat|allow always|approve|deny|don'?t allow|reject|continue|允许|允许一次|始终允许|总是允许|本次允许|拒绝|批准|不允许|继续)$",
  // 额外的确认区域选择器（可选，逗号分隔）
  confirmSelector: '',
  doneHoldSec: 10,
  confirmAngrySec: 45,  // 确认按钮挂着多久没人点 → 生气
  errorHoldSec: 8,      // 出错后生气多久
  drowsyAfterSec: 90,   // 待机多久后犯困
  sleepAfterMin: 3,     // 待机多久后睡着
  sparkTyping: false, // Spark Typing：在聊天框里打字时迸火星（右键菜单里开关）
  sparkSound: false,  // Spark Typing 的打字机声音（默认关）
  pos: null, // {right, bottom}
};

// 支持的 AI 聊天站（同一时间只盯一个，在设置里切换）
// hosts：哪些网址算这个站（ChatGPT 的老网址 chat.openai.com 现在会跳到 chatgpt.com，两个都认）
window.CLAUDE_CHAN_SITES = {
  claude:   { id: 'claude',   name: 'Claude',   host: 'claude.ai',         url: 'https://claude.ai/new',      match: 'https://claude.ai/*' },
  deepseek: { id: 'deepseek', name: 'DeepSeek', host: 'chat.deepseek.com', url: 'https://chat.deepseek.com/', match: 'https://chat.deepseek.com/*' },
  chatgpt:  { id: 'chatgpt',  name: 'ChatGPT',  host: 'chatgpt.com', hosts: ['chatgpt.com', 'chat.openai.com'], url: 'https://chatgpt.com/', match: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] },
};
