/**
 * WhatsApp Web DOM helpers + selectors (current WA Web SPA).
 * Selectors intentionally have fallbacks for class name changes.
 */
(function (global) {
  "use strict";

  const WADOM = {
    SELECTORS: {
      paneSide: '[data-testid="pane-side"], #pane-side',
      chatList: '[data-testid="chat-list"], #pane-side',
      chatListItem: '[data-testid="chat-list-item"], [role="listitem"], div[tabindex="-1"]',
      conversationHeader: '#main header, [data-testid="conversation-info-header"]',
      conversationTitle: '#main header span[dir="auto"], #main header span[title], [data-testid="conversation-info-header-chat-title"]',
      messageList: '[role="region"][aria-label][tabindex="0"], #main div[role="region"]',
      messageRow: '[data-id], div.message-in, div.message-out',
      incoming: '.message-in',
      outgoing: '.message-out',
      messageMeta: '[data-testid="msg-meta"], span[dir="auto"][class*="copyable-text"]',
      imageThumb: 'img[src^="blob:"], img[src^="data:"], img[style*="visibility"]',
      video: 'video, [data-testid="media-video"]',
      audio: 'audio, [data-testid="audio-playback"]',
      doc: 'a[download], [data-testid="media-document"]',
      toolbar: '#main header, header[data-testid="conversation-header"]',
    },

    q(root, sel) {
      return (root || document).querySelector(sel);
    },

    qa(root, sel) {
      return Array.from((root || document).querySelectorAll(sel));
    },

    waitFor(sel, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const el = document.querySelector(sel);
        if (el) return resolve(el);
        const obs = new MutationObserver(() => {
          const found = document.querySelector(sel);
          if (found) {
            obs.disconnect();
            resolve(found);
          }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => {
          obs.disconnect();
          reject(new Error(`Timeout waiting for ${sel}`));
        }, timeout);
      });
    },

    sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },

    /** Extract chat list items from left pane */
    getChatListItems() {
      const side = document.querySelector(this.SELECTORS.paneSide);
      if (!side) return [];
      const items = side.querySelectorAll('[role="listitem"]');
      if (items.length) return Array.from(items);
      // fallback: cells with chat titles
      return Array.from(
        side.querySelectorAll('div[tabindex="-1"], div[role="row"]')
      ).filter((el) => el.querySelector('span[title]'));
    },

    getChatInfoFromListItem(el) {
      const titleEl =
        el.querySelector('span[title]') ||
        el.querySelector('span[dir="auto"]');
      const title = titleEl?.getAttribute("title") || titleEl?.textContent?.trim() || "Unknown";
      const preview =
        el.querySelector('span[title][class*="selectable-text"], div[title] span')?.textContent?.trim() || "";
      const time =
        el.querySelector('span[dir="auto"][class*="time"], time')?.textContent?.trim() ||
        el.querySelector('span[title] + span')?.textContent?.trim() ||
        "";
      const unreadEl = el.querySelector('span[aria-label*="unread"], div[aria-label*="unread"]');
      const img = el.querySelector('img');
      const avatar = img?.src || "";
      return { title, preview, time, avatar, unread: !!unreadEl, element: el };
    },

    getActiveChatTitle() {
      const header = document.querySelector(this.SELECTORS.conversationHeader);
      if (!header) return "";
      const el =
        header.querySelector('span[title]') ||
        header.querySelector('span[dir="auto"]');
      return el?.getAttribute("title") || el?.textContent?.trim() || "";
    },

    getMessageScroller() {
      const scroller =
        document.querySelector('#main div[role="region"][tabindex="0"]') ||
        document.querySelector('#main div[style*="overflow-y"]') ||
        document.querySelector('#main div[class*="message-list"]');
      if (!scroller) return null;

      let box = scroller;
      const candidates = [scroller, ...scroller.querySelectorAll('div')];
      for (const c of candidates) {
        const style = getComputedStyle(c);
        if (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          c.scrollHeight > c.clientHeight + 50
        ) {
          box = c;
          break;
        }
      }
      return box;
    },

    async scrollToTopOfChat(maxScrolls = 80) {
      const box = this.getMessageScroller();
      if (!box) return;
      for (let i = 0; i < maxScrolls; i++) {
        const prev = box.scrollTop;
        box.scrollTop = 0;
        box.dispatchEvent(new Event('scroll', { bubbles: true }));
        await this.sleep(350);
        if (box.scrollTop === 0 && i > 3) break;
        if (Math.abs(box.scrollTop - prev) < 2 && box.scrollTop === 0) break;
      }
      await this.sleep(500);
    },

    /**
     * Walk from bottom to top, invoking onChunk() after each window of scroll
     * so the caller can merge messages before virtualization unmounts them.
     */
    async walkChatHistory(options = {}) {
      const { maxSteps = 80, stepPx = 600, delay = 450, onChunk } = options;
      const box = this.getMessageScroller();
      if (!box) return { steps: 0 };

      // start at bottom
      box.scrollTop = box.scrollHeight;
      await this.sleep(delay);

      if (onChunk) await onChunk(0);

      for (let i = 1; i <= maxSteps; i++) {
        const before = box.scrollTop;
        box.scrollTop = Math.max(0, before - stepPx);
        box.dispatchEvent(new Event('scroll', { bubbles: true }));
        await this.sleep(delay);
        if (onChunk) await onChunk(i);
        if (box.scrollTop <= 0) break;
        if (Math.abs(box.scrollTop - before) < 1) break;
      }
      await this.sleep(300);
      return { steps: maxSteps };
    },

    async clickChat(listItemEl) {
      const clickable =
        listItemEl.querySelector('div[role="button"]') ||
        listItemEl.querySelector('div[tabindex]') ||
        listItemEl;
      clickable.click();
      await this.sleep(800);
    },
  };

  global.WADOM = WADOM;
})(typeof self !== "undefined" ? self : globalThis);
