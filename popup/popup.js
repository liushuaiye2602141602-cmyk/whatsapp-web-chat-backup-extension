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
      setStatus("未检测到 WhatsApp Web 标签页。点下方「打开 WhatsApp Web」。");
      return null;
    }
    const res = await chrome.tabs.sendMessage(tabs[0].id, { type: "WABK_STATUS" }).catch(() => null);
    if (res && res.ok) {
      setStatus(`已连接：${res.title || "WhatsApp"} · 列表 ${res.chats} 个会话`);
      return res;
    }
    setStatus("已打开 WhatsApp，但脚本未就绪。请刷新页面后重试。");
    return null;
  } catch {
    setStatus("无法连接 WhatsApp Web。");
    return null;
  }
}

document.getElementById("btn-open").addEventListener("click", async () => {
  const res = await send({ action: "WABK_OPEN" });
  if (!res?.ok) setStatus(res?.error || "已尝试打开面板");
  else setStatus("面板已打开");
});

document.getElementById("btn-export-active").addEventListener("click", async () => {
  const res = await send({ action: "WABK_EXPORT_ACTIVE" });
  if (!res?.ok) setStatus(res?.error || "导出失败");
  else setStatus("正在导出当前聊天…");
});

document.getElementById("btn-media").addEventListener("click", async () => {
  const res = await send({ action: "WABK_QUICK_MEDIA" });
  if (!res?.ok) setStatus(res?.error || "媒体导出失败");
  else setStatus(`已打包 ${res.count ?? 0} 个媒体文件`);
});

document.getElementById("btn-open-wa").addEventListener("click", async () => {
  await send({ action: "open" });
  setStatus("已打开 WhatsApp Web，请等待聊天列表加载。");
});

refreshStatus();
