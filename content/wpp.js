/**
 * Content-script side of the WPP CustomEvent bridge.
 */
(function (global) {
  "use strict";

  let injectTried = false;

  const WABridge = {
    isInjected() {
      return injectTried;
    },

    /** Inject wppconnect + bridge into page world (once). */
    inject() {
      if (injectTried) return;
      injectTried = true;

      const load = (src, id) =>
        new Promise((resolve) => {
          if (document.getElementById(id)) return resolve(true);
          const s = document.createElement("script");
          s.id = id;
          s.src = chrome.runtime.getURL(src);
          s.onload = () => {
            s.remove();
            resolve(true);
          };
          s.onerror = () => {
            s.remove();
            resolve(false);
          };
          (document.head || document.documentElement).appendChild(s);
        });

      // sequential: WPP library first, then bridge
      (async () => {
        const a = await load("libs/wppconnect-wa.js", "wabk-wpp-lib");
        const b = await load("injected.js", "wabk-wpp-bridge");
        console.info("[WABK] inject", { wpp: a, bridge: b });
      })();
    },

    /**
     * Call injected bridge.
     * @param {string} eventName
     * @param {object} params
     * @param {number} timeoutMs
     */
    call(eventName, params = {}, timeoutMs = 20000) {
      return new Promise((resolve, reject) => {
        const resultEvent = "WABK_wpp_" + eventName + "_result";
        const timer = setTimeout(() => {
          window.removeEventListener(resultEvent, onResult);
          reject(new Error("WPP bridge timeout: " + eventName));
        }, timeoutMs);

        function onResult(e) {
          clearTimeout(timer);
          window.removeEventListener(resultEvent, onResult);
          resolve(e.detail);
        }

        window.addEventListener(resultEvent, onResult);
        window.dispatchEvent(
          new CustomEvent("WABK_wpp", { detail: { eventName, params } })
        );
      });
    },

    async isMainReady(timeoutMs = 3000) {
      try {
        return !!(await this.call("isMainReady", {}, timeoutMs));
      } catch {
        return false;
      }
    },

    async waitReady(maxWaitMs = 25000) {
      this.inject();
      const start = Date.now();
      // poll
      while (Date.now() - start < maxWaitMs) {
        try {
          await this.call("keepAlive", {}, 2000);
        } catch {
          /* ignore */
        }
        if (await this.isMainReady(2000)) return true;
        await new Promise((r) => setTimeout(r, 800));
      }
      return false;
    },

    getChatList() {
      return this.call("getChatList");
    },

    getActiveChat() {
      return this.call("getActiveChat");
    },

    getMessages(chats, count = -1) {
      return this.call("getMessages", { chats, count });
    },

    downloadMedia(id) {
      return this.call("downloadMedia", { id });
    },

    getProfilePicture(chatId) {
      return this.call("getProfilePicture", { chatId });
    },
  };

  global.WABridge = WABridge;
})(typeof self !== "undefined" ? self : globalThis);
