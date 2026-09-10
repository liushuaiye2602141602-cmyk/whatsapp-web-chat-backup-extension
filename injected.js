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

  function isLidJid(jid) {
    return /@lid\b/i.test(String(jid || ""));
  }

  function normalizeMessage(msg, chatHint) {
    const id = messageId(msg);
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

    // Only use reactions already on the model — never fan out getReactions per message.
    const inline = mapReactions(msg && msg.reactions);

    // 1:1 chat: prefer chat contact name/phone over raw LID from message author
    let displayName = "";
    let phone = "";
    if (fromMe) {
      displayName = "我";
    } else {
      phone = phoneOf(author);
      if (isLidJid(author) || (phone && phone.length > 12 && !/@c\.us|@s\.whatsapp\.net/i.test(String(author)))) {
        // LID — use chat-level identity when available
        displayName = (chatHint && chatHint.name) || "";
        phone = (chatHint && chatHint.phone) || "";
      } else {
        displayName = phone || "";
      }
    }

    return {
      id,
      time,
      type,
      fromMe,
      displayName,
      formattedName: displayName,
      phone,
      reactions: inline,
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

  function messageId(msg) {
    const id = msg && msg.id;
    if (!id) return "";
    if (typeof id === "string") return id;
    if (id._serialized) return String(id._serialized);
    if (typeof id.toString === "function") {
      const s = id.toString();
      if (s && s !== "[object Object]") return s;
    }
    return "";
  }

  async function getMessages(params) {
    const WPP = getWPP();
    if (!WPP || !WPP.chat || !WPP.chat.getMessages) return null;
    const chats = (params && params.chats) || [];
    if (!Array.isArray(chats) || !chats.length) return null;
    // -1 = full history; large chats can be slow — caller should call per chat.
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
      // 1:1: attach chat name/phone so bubbles don't show raw LID
      const chatHint = { name: chat.name || "", phone: chat.phone || "" };
      // resolve contact once per chat if phone missing
      if (!chatHint.phone && chat.id && !String(chat.id).includes("@g.us")) {
        try {
          const info = await getContactInfo(chat.id);
          if (info) {
            if (info.name) chatHint.name = chatHint.name || info.name;
            if (info.phone) chatHint.phone = info.phone;
          }
        } catch {
          /* ignore */
        }
      }
      const items = raw
        .map((msg) => normalizeMessage(msg, chatHint))
        .filter((m) => m.id || m.message || m.caption);
      out.push({ chatId: chat.id, chatName: chat.name || chatHint.name || "", phone: chatHint.phone || "", items });
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
      return (list || []).map((c) => {
        const contact = c.contact || {};
        const idStr = String(c.id || c.chatId || "");
        const phone =
          contact.formattedPhone ||
          contact.phoneNumber ||
          contact.number ||
          phoneOf(contact.id) ||
          (idStr.includes("@c.us") ? phoneOf(idStr) : "");
        return {
          id: idStr,
          name:
            contact.formattedName ||
            contact.name ||
            contact.pushname ||
            c.formattedTitle ||
            c.name ||
            idStr,
          phone: phone ? String(phone).replace(/[^\d+]/g, "") : "",
        };
      });
    } catch (e) {
      console.warn("[WABK] chat.list failed", e);
      return [];
    }
  }

  /** Resolve display name + real phone for one chat (for filenames). */
  async function getContactInfo(chatId) {
    const WPP = getWPP();
    const idStr = String(chatId || "");
    let name = "";
    let phone = "";
    try {
      if (WPP && WPP.contact && WPP.contact.queryExists) {
        // may fail for @lid
      }
      if (WPP && WPP.contact && typeof WPP.contact.get === "function") {
        const contact = await WPP.contact.get(idStr);
        if (contact) {
          name = contact.formattedName || contact.name || contact.pushname || "";
          phone =
            contact.formattedPhone ||
            contact.phoneNumber ||
            contact.number ||
            phoneOf(contact.id || idStr) ||
            "";
        }
      }
    } catch {
      /* ignore */
    }
    // fallback from chat model
    try {
      if (WPP && WPP.chat && typeof WPP.chat.get === "function") {
        const chat = await WPP.chat.get(idStr);
        if (chat) {
          const contact = chat.contact || {};
          name = name || contact.formattedName || chat.formattedTitle || "";
          phone =
            phone ||
            contact.formattedPhone ||
            contact.phoneNumber ||
            phoneOf(contact.id) ||
            "";
        }
      }
    } catch {
      /* ignore */
    }
    if (!phone && idStr.includes("@c.us")) phone = phoneOf(idStr);
    phone = String(phone || "").replace(/[^\d+]/g, "");
    return { id: idStr, name: name || "", phone };
  }

  async function getActiveChat() {
    const WPP = getWPP();
    try {
      if (WPP && WPP.chat && WPP.chat.getActiveChat) {
        const c = WPP.chat.getActiveChat();
        if (!c) return null;
        const contact = c.contact || {};
        return {
          id: String(c.id || ""),
          name:
            contact.formattedName ||
            c.formattedTitle ||
            c.name ||
            String(c.id || ""),
          phone:
            contact.formattedPhone ||
            contact.phoneNumber ||
            phoneOf(contact.id) ||
            (String(c.id).includes("@c.us") ? phoneOf(String(c.id)) : ""),
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
    getContactInfo: (params) => getContactInfo(params && params.chatId),
    getMessages,
    downloadMedia: (params) => downloadMedia(params && params.id),
    getProfilePicture: (params) => getProfilePicture(params && params.chatId),
  };

  window.addEventListener("WABK_wpp", async (event) => {
    const detail = event.detail || {};
    const eventName = detail.eventName || "";
    const params = detail.params || {};
    const requestId = detail.requestId || "";
    const fn = handlers[eventName];
    let payload = null;
    let error = null;
    try {
      payload = fn ? await fn(params) : { error: "unknown event " + eventName };
      if (payload && payload.error) error = payload.error;
    } catch (e) {
      error = String((e && e.message) || e);
      payload = { error };
    }
    // Single correlated result channel — avoids same-event cross-talk.
    const out = { requestId, eventName, ok: !error, data: error ? null : payload, error };
    try {
      window.dispatchEvent(new CustomEvent("WABK_wpp_result", { detail: out }));
    } catch (cloneErr) {
      // e.g. DataCloneError on unexpected payloads
      window.dispatchEvent(
        new CustomEvent("WABK_wpp_result", {
          detail: {
            requestId,
            eventName,
            ok: false,
            data: null,
            error: "result not cloneable: " + cloneErr,
          },
        })
      );
    }
  });

  console.info("[WABK] WPP bridge installed");
})();
