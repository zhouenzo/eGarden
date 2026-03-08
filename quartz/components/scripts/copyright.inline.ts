document.addEventListener('copy', (event: ClipboardEvent) => {
  const selection = document.getSelection();
  
  // 1. 增加非空校验及长度校验
  if (!selection || selection.toString().length < 30) {
    return;
  }

  const originalText = selection.toString();
  const copyright = `\n\n------------------------------\n` +
                    `著作权归作者所有。\n` +
                    `商业转载请联系作者获得授权，非商业转载请注明出处。\n` +
                    `原文链接: ${window.location.href}\n` +
                    `来源: e Blog`;

  // 2. 直接操作剪贴板数据，避免修改 DOM 导致的闪烁或选区丢失
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', originalText + copyright);
    // 3. 必须阻止默认行为，否则浏览器会用原始选区覆盖掉 setData 的内容
    event.preventDefault();
  }
});

