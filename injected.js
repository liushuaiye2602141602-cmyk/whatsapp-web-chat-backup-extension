/**
 * Injected into WhatsApp Web page world.
 * Exposes WPPConnect Store APIs via CustomEvent bridge.
 * Events: WABK_wpp → WABK_wpp_${eventName}_result
 */
(function () {
  "use strict";
  if (window.__WABK_WPP_BRIDGE__) return;
  window.__WABK_WPP_BRIDGE__ = true;

  function getWPP() {
    return window.WPP || null;
  }

  function ready() {
    const WPP = getWPP();
    try {
      return !!(WPP && WPP.conn && WPP.conn.isMainReady && WPP.conn.isMainReady());
    } catch {
      return false;
    }
  }

  function phoneOf(jid) {
    if (!jid) return "";
    const s = String(jid);
    return s.split("@")[0].split(":")[0] || "";
  }

  function mapReactions(list) {
    if (!Array.isArray(list)) return [];
    return list.map((r) => ({
      text: r.aggregateEmoji || r.text || "",
      senders: (r.senders || []).map((s) => {
        const user = s && s.sender && s.sender.user;
        return user || s || "";
      }),
    }));
  }

  async function getReactionsSafe(msgId) {
    const WPP = getWPP();
    try {
      if (WPP && WPP.chat && WPP.chat.getReactions) {
        const r = await WPP.chat.getReactions(msgId);
        return mapReactions(r && r.reactions);
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  function normalizeMessage(msg) {
    const id = msg && msg.id ? String(msg.id) : "";
    const type = (msg && msg.type) || "chat";
    const fromMe = !!(msg && msg.id && msg.id.fromMe);
    const author = msg && (msg.author || msg.from || msg.to || "");
    const isImage = type === "image" || type === "sticker";
    const isVideo = type === "video";
    const isAudio = type === "audio" || type === "ptt";
    const isDocument = type === "document";
    const isMedia = !!(isImage || isVideo || isAudio || isDocument || (msg && msg.hasMedia));

    const timeMs = (msg && (msg.t || msg.timestamp || msg.timestampUnix)) || 0;
    const time = typeof timeMs === "number" && timeMs < 1e12 ? timeMs * 1000 : timeMs;

    return {
      id,
      time,
      type,
      fromMe,
      displayName: fromMe ? "我" : phoneOf(author) || "",
      formattedName: fromMe ? "我" : phoneOf(author) || "",
      phone: phoneOf(author),
      reactions: mapReactions(msg && msg.reactions),
      isMedia,
      isImage,
      isAudio,
      isVideo,
      isDocument,
      message: type === "chat" ? msg.body || "" : "",
      caption: msg && msg.caption ? msg.caption : "",
      filename: (msg && msg.filename) || "",
      size: (msg && msg.size) || 0,
      _rawHasMedia: !!(msg && msg.hasMedia),
    };
  }

  async function getMessages(params) {
    const WPP = getWPP();
    if (!WPP || !WPP.chat || !WPP.chat.getMessages) return null;
    const chats = (params && params.chats) || [];
    if (!Array.isArray(chats) || !chats.length) return null;
    const count = params && typeof params.count === "number" ? params.count : -1;
    const out = [];

    for (const chat of chats) {
      let raw = [];
      try {
        raw = await WPP.chat.getMessages(chat.id, { count });
      } catch (e) {
        console.warn("[WABK] getMessages failed", chat.id, e);
      }
      if (!Array.isArray(raw)) raw = [];

      const items = [];
      for (const msg of raw) {
        const item = normalizeMessage(msg);
        // try enrich reactions from API
        if (item.id && (!item.reactions || !item.reactions.length)) {
          item.reactions = await getReactionsSafe(item.id);
        }
        items.push(item);
      }
      out.push({ chatId: chat.id, chatName: chat.name || "", items });
    }
    return out;
  }

  async function downloadMedia(id) {
    const WPP = getWPP();
    if (!WPP || !WPP.chat || !WPP.chat.downloadMedia) return null;
    try {
      const media = await WPP.chat.downloadMedia(id);
      return media || null;
    } catch (e) {
      console.warn("[WABK] downloadMedia failed", id, e);
      return null;
    }
  }

  async function getChatList() {
    const WPP = getWPP();
    if (!WPP || !WPP.chat || !WPP.chat.list) return [];
    try {
      const list = await WPP.chat.list();
      return (list || []).map((c) => ({
        id: String(c.id || c.chatId || ""),
        name:
          (c.contact && (c.contact.formattedName || c.contact.name || c.contact.pushname)) ||
          c.formattedTitle ||
          c.name ||
          String(c.id || ""),
      }));
    } catch (e) {
      console.warn("[WABK] chat.list failed", e);
      return [];
    }
  }

  async function getActiveChat() {
    const WPP = getWPP();
    try {
      if (WPP && WPP.chat && WPP.chat.getActiveChat) {
        const c = WPP.chat.getActiveChat();
        if (!c) return null;
        return {
          id: String(c.id || ""),
          name:
            (c.contact && c.contact.formattedName) ||
            c.formattedTitle ||
            c.name ||
            String(c.id || ""),
        };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function getProfilePicture(chatId) {
    const WPP = getWPP();
    try {
      if (WPP && WPP.contact && WPP.contact.getProfilePictureUrl) {
        return (await WPP.contact.getProfilePictureUrl(chatId)) || "";
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  const handlers = {
    isMainReady: () => ready(),
    keepAlive: () => {
      try {
        getWPP()?.conn?.setKeepAlive?.(true);
      } catch {
        /* ignore */
      }
      return true;
    },
    getChatList,
    getActiveChat,
    getMessages,
    downloadMedia: (params) => downloadMedia(params && params.id),
    getProfilePicture: (params) => getProfilePicture(params && params.chatId),
  };

  window.addEventListener("WABK_wpp", async (event) => {
    const detail = event.detail || {};
    const eventName = detail.eventName || "";
    const params = detail.params || {};
    const fn = handlers[eventName];
    let result = null;
    try {
      result = fn ? await fn(params) : { error: "unknown event " + eventName };
    } catch (e) {
      result = { error: String((e && e.message) || e) };
    }
    window.dispatchEvent(
      new CustomEvent("WABK_wpp_" + eventName + "_result", { detail: result })
    );
  });

  console.info("[WABK] WPP bridge installed");
})();
