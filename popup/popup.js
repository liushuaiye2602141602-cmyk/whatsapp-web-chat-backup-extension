async function send(msg) {
  return chrome.runtime.sendMessage(msg);
}
function setStatus(text) {
  document.getElementById("status").textContent = text;
}
async function refreshStatus() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    if (!tabs.length) {
      setStatus("未检测到 WhatsApp Web。点「打开 WhatsApp Web」。");
      return;
    }
    const res = await chrome.tabs.sendMessage(tabs[0].id, { type: "WABK_STATUS" }).catch(() => null);
    if (res && res.ok) {
      setStatus(`已连接 · WPP ready=${!!res.ready} · 列表 ${res.chats}`);
      return;
    }
    setStatus("已打开 WhatsApp，脚本未就绪。请 F5 刷新页面。");
  } catch {
    setStatus("无法连接 WhatsApp Web。");
  }
}
document.getElementById("btn-open").addEventListener("click", async () => {
  const res = await send({ action: "WABK_OPEN" });
  setStatus(res?.ok ? "面板已打开" : res?.error || "已尝试打开");
});
document.getElementById("btn-export-active").addEventListener("click", async () => {
  const res = await send({ action: "WABK_EXPORT_ACTIVE" });
  setStatus(res?.ok ? "正在导出当前聊天…" : res?.error || "导出失败");
});
document.getElementById("btn-open-wa").addEventListener("click", async () => {
  await send({ action: "open" });
  setStatus("已打开 WhatsApp Web");
});
refreshStatus();
