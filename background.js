/**
 * Background service worker: relays popup actions to content script.
 */

async function getWhatsAppTab() {
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (tabs && tabs.length) return tabs[0];
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active && active.url && active.url.startsWith("https://web.whatsapp.com/")) return active;
  return null;
}

async function openWhatsApp() {
  const existing = await getWhatsAppTab();
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    return existing;
  }
  return chrome.tabs.create({ url: "https://web.whatsapp.com/" });
}

async function sendToWA(message) {
  const tab = await getWhatsAppTab();
  if (!tab) {
    await openWhatsApp();
    return { ok: false, error: "Opened WhatsApp Web. Wait for chats to load, then try again." };
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, message);
    return res || { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: "Content script not ready. Refresh WhatsApp Web and try again.",
      detail: String(e && e.message ? e.message : e),
    };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "WABK_PING_BG") {
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "WABK_OPEN_WA" || msg.action === "open") {
    openWhatsApp().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.action) {
    sendToWA({ type: msg.action }).then(sendResponse);
    return true;
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  // popup is set, so this usually won't fire; keep as fallback
  if (tab && tab.url && tab.url.startsWith("https://web.whatsapp.com/")) {
    sendToWA({ type: "WABK_OPEN" });
  }
});
