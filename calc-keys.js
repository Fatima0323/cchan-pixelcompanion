// Claude 娘 · 计算器 —— 键盘钩子
// 这个文件在网页自己的脚本之前加载（document_start），所以这里挂的监听器排在最前面：
// 计算器被点中（有焦点）的时候，按键 / 复制 / 粘贴先交给计算器，网页就收不到了，
// 免得网页把你按的数字拿去做别的事（比如跳到输入框）。没打开计算器时什么也不做。
(function () {
  'use strict';
  if (window.__claudeChanKeyHookInstalled) return;
  window.__claudeChanKeyHookInstalled = true;
  const pass = (e) => {
    const h = window.ClaudeChanKeyHook;
    let took = false;
    try { took = !!(h && h(e)); } catch (err) { took = false; }
    if (took) {
      if (e.type.startsWith('key')) e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  for (const t of ['keydown', 'keypress', 'keyup', 'copy', 'paste', 'cut']) window.addEventListener(t, pass, true);
})();
