// 内容脚本与弹窗共用的默认设置
window.CLAUDE_CHAN_DEFAULTS = {
  enabled: true,
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
  pos: null, // {right, bottom}
};
