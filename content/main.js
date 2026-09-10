/**
 * Bootstrap: inject WPP + UI on WhatsApp Web.
 */
(function () {
  "use strict";
  if (window.__WABK_LOADED__) return;
  window.__WABK_LOADED__ = true;

  function boot() {
    WABridge.inject();
    WAUI.ensureToolbarButton();
    WAUI.buildPanel();

    const obs = new MutationObserver(() => {
      WAUI.ensureToolbarButton();
    });
    obs.observe(document.body, { childList: true, subtree: true });

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
      if (msg.type === "WABK_STATUS") {
        WABridge.isMainReady().then((ready) => {
          sendResponse({
            ok: true,
            open: WAUI.state.open,
            chats: WAUI.state.chats.length,
            ready,
          });
        });
        return true;
      }
    });

    console.info("[WA Chats Backup Pro] ready (WPP bridge)");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 500));
  } else {
    setTimeout(boot, 500);
  }
})();
