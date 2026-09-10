/**
 * Bootstrap on WhatsApp Web.
 */
(function () {
  "use strict";

  if (window.__WABK_LOADED__) return;
  window.__WABK_LOADED__ = true;

  function boot() {
    WAUI.ensureToolbarButton();
    WAUI.buildPanel();

    // Keep injecting button when WA re-renders header
    const obs = new MutationObserver(() => {
      WAUI.ensureToolbarButton();
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Message from popup / background
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || !msg.type) return;
      if (msg.type === "WABK_OPEN") {
        WAUI.setOpen(true);
        sendResponse({ ok: true, chats: WAUI.state.chats.length });
        return true;
      }
      if (msg.type === "WABK_EXPORT_ACTIVE") {
        WAUI.setOpen(true);
        WAUI.startExport(true).then(() => sendResponse({ ok: true }));
        return true;
      }
      if (msg.type === "WABK_EXPORT_SELECTED") {
        WAUI.setOpen(true);
        WAUI.startExport(false).then(() => sendResponse({ ok: true }));
        return true;
      }
      if (msg.type === "WABK_STATUS") {
        sendResponse({
          ok: true,
          open: WAUI.state.open,
          chats: WAUI.state.chats.length,
          title: WADOM.getActiveChatTitle(),
        });
        return true;
      }
      if (msg.type === "WABK_QUICK_MEDIA") {
        WAUI.setOpen(true);
        WAUI.quickExportMedia().then((n) => sendResponse({ ok: true, count: n }));
        return true;
      }
    });

    console.info("[WA Chats Backup Pro] ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 800));
  } else {
    setTimeout(boot, 800);
  }
})();
