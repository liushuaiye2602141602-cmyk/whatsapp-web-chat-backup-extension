/**
 * Parse WhatsApp Web conversation DOM into structured messages.
 * Multiple selector strategies to survive WA Web class renames.
 */
(function (global) {
  "use strict";

  function textOf(el) {
    if (!el) return "";
    return (el.innerText || el.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function looksLikeMessageId(id) {
    if (!id || id.length < 8) return false;
    // WA ids often: true_...@c.us_HEX / false_...@s.whatsapp.net_HEX / @lid
    if (id.includes("@")) return true;
    if (/^[0-9a-fA-F]{8,}/.test(id) || id.includes("_")) return true;
    return id.length >= 16;
  }

  function pickMessageNodes() {
    const root =
      document.querySelector("#main") ||
      document.querySelector('[data-testid="conversation-panel-messages"]') ||
      document.body;

    const candidates = [];

    const push = (el) => {
      if (!el || !(el instanceof Element)) return;
      candidates.push(el);
    };

    // 1) classic message-in / message-out
    root.querySelectorAll(".message-in, .message-out").forEach(push);

    // 2) data-testid containers
    root
      .querySelectorAll(
        '[data-testid="msg-container"], [data-testid="message-container"], [data-testid="conversation-text-messages"]'
      )
      .forEach(push);

    // 3) [data-id] that looks like a message id (only in main pane)
    root.querySelectorAll("[data-id]").forEach((el) => {
      const id = el.getAttribute("data-id") || "";
      if (looksLikeMessageId(id)) push(el);
    });

    // 4) role=row inside conversation region
    root.querySelectorAll('div[role="region"] [role="row"]').forEach(push);

    // Deduplicate: keep outermost among duplicates; drop nodes contained in another kept node
    const uniq = [];
    const seen = new Set();
    for (const el of candidates) {
      if (seen.has(el)) continue;
      seen.add(el);
      uniq.push(el);
    }

    // Prefer nodes that are not descendants of another candidate (message wrappers)
    const kept = uniq.filter((el) => {
      return !uniq.some((other) => other !== el && other.contains(el) && other.querySelector("[data-id], .message-in, .message-out, [data-testid='msg-container']"));
    });

    // If filter too aggressive, fall back to uniq
    const list = kept.length ? kept : uniq;

    // Final: drop tiny UI crumbs without text and without media
    return list.filter((el) => {
      const hasMedia =
        el.querySelector("img, video, audio, a[download], [data-testid='media-document']") ||
        el.querySelector('[data-testid="audio-playback"]');
      const hasText =
        el.querySelector(
          "span.selectable-text, [data-testid='conversation-text'], [data-pre-plain-text], span[dir='ltr']"
        );
      const own = textOf(el).length > 0;
      return !!(hasMedia || hasText || own);
    });
  }

  function detectDirection(row) {
    const cls = String(row.className || "");
    if (cls.includes("message-out") || row.closest(".message-out")) return "out";
    if (cls.includes("message-in") || row.closest(".message-in")) return "in";

    // data-id prefix: true_ often outgoing in some dumps; WhatsApp uses both
    const id = row.getAttribute("data-id") || "";
    if (id.startsWith("true_")) return "out";
    if (id.startsWith("false_")) return "in";

    // alignment: outgoing usually on the right — check style or parent align
    const style = getComputedStyle(row);
    if (style.marginLeft && style.marginRight === "auto") return "out";

    // pre-plain-text sometimes only on incoming
    const pre = row.querySelector("[data-pre-plain-text]")?.getAttribute("data-pre-plain-text") || "";
    if (pre) return "in";

    return "out"; // default (many tools default unknown to me)
  }

  function parseTime(row) {
    const pre =
      row.querySelector("[data-pre-plain-text]")?.getAttribute("data-pre-plain-text") || "";
    // [19:40, 8/12/2026] Name:
    const m = pre.match(/\[([^\]]+)\]/);
    if (m) return m[1];

    const title =
      row.querySelector('[data-testid="msg-meta"] span[title]')?.getAttribute("title") ||
      row.querySelector('[data-testid="msg-meta"] span')?.textContent?.trim() ||
      "";
    if (title) return title;

    const time = row.querySelector("time")?.getAttribute("datetime") ||
      row.querySelector("time")?.textContent?.trim() ||
      "";
    return time || "";
  }

  function parseSender(row, outgoing) {
    if (outgoing) return "我";
    const pre = row.querySelector("[data-pre-plain-text]")?.getAttribute("data-pre-plain-text") || "";
    const m = pre.match(/\]\s*([^:]+):\s*$/);
    if (m) return m[1].trim();
    const meta = row.querySelector('[data-testid="msg-meta"]');
    const spans = meta?.querySelectorAll("span[title]") || [];
    if (spans.length) {
      const t = spans[0].getAttribute("title") || spans[0].textContent.trim();
      if (t && !/^\d/.test(t)) return t;
    }
    return "联系人";
  }

  function extractText(row) {
    // Prefer dedicated text nodes
    const blocks = row.querySelectorAll(
      '[data-testid="conversation-text"], span.selectable-text, [data-testid="conversation-text-messages"]'
    );
    if (blocks.length) {
      return Array.from(blocks)
        .map((b) => textOf(b))
        .filter(Boolean)
        .join("\n")
        .trim();
    }

    // fallback: copyable-text spans
    const copyables = row.querySelectorAll('span[class*="copyable-text"]');
    if (copyables.length) {
      return Array.from(copyables)
        .map((b) => textOf(b))
        .filter(Boolean)
        .join("\n")
        .trim();
    }

    let text = textOf(row);

    // strip data-pre-plain-text header if leaked into innerText
    const pre = row.querySelector("[data-pre-plain-text]")?.getAttribute("data-pre-plain-text") || "";
    if (pre && text.startsWith(pre)) text = text.slice(pre.length).trim();

    const metaText = textOf(row.querySelector('[data-testid="msg-meta"]'));
    if (metaText && text.endsWith(metaText)) {
      text = text.slice(0, -metaText.length).trim();
    }

    // strip reaction lines
    const rx = textOf(row.querySelector('[data-testid="reaction"]'));
    if (rx && text.endsWith(rx)) text = text.slice(0, -rx.length).trim();

    return text;
  }

  async function blobFromUrl(url) {
    try {
      if (!url) return null;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) {
      console.warn("[WABackup] fetch media failed", url, e);
      return null;
    }
  }

  function extFromMime(mime, fallback) {
    if (!mime) return fallback;
    const map = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/3gpp": "3gp",
      "video/quicktime": "mov",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "application/pdf": "pdf",
      "application/zip": "zip",
    };
    if (map[mime]) return map[mime];
    const sub = mime.split("/")[1];
    return sub ? sub.split("+")[0] : fallback;
  }

  const WAParser = {
    pickMessageNodes,
    detectDirection,
    extractText,

    diagnose() {
      const main = !!document.querySelector("#main");
      const header = !!document.querySelector("#main header");
      const scroller =
        document.querySelector('#main div[role="region"][tabindex="0"]') ||
        document.querySelector("#main div[role='region']");
      const nodes = pickMessageNodes();
      const parsed = nodes.slice(0, 3).map((n) => ({
        id: n.getAttribute("data-id"),
        dir: detectDirection(n),
        textPreview: extractText(n).slice(0, 80),
        classes: String(n.className).slice(0, 80),
        testid: n.getAttribute("data-testid"),
      }));
      return {
        url: location.href,
        main,
        header,
        hasScroller: !!scroller,
        messageNodes: nodes.length,
        sample: parsed,
        title: (document.querySelector("#main header span[title]")?.getAttribute("title") ||
          document.querySelector("#main header span[dir='auto']")?.textContent ||
          "").trim(),
      };
    },

    async parseConversation(options = {}) {
      const { includeMedia = true, maxMessages = 5000 } = options;
      const rows = pickMessageNodes();
      const seen = new Set();
      const messages = [];
      let mediaIndex = 0;

      for (const row of rows) {
        if (messages.length >= maxMessages) break;

        const dataId = row.getAttribute("data-id");
        if (dataId) {
          if (seen.has(dataId)) continue;
          seen.add(dataId);
        }

        const direction = detectDirection(row);
        const text = extractText(row);
        const media = [];

        if (includeMedia) {
          const imgs = row.querySelectorAll("img");
          for (const img of imgs) {
            const src = img.currentSrc || img.src || "";
            if (!src || src.startsWith("chrome-extension:")) continue;
            if (img.closest("header")) continue;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w && w < 40 && h && h < 40) continue;
            // skip avatar-like
            const parentTest = img.closest("[data-testid]")?.getAttribute("data-testid") || "";
            if (/avatar|emoji/i.test(parentTest)) continue;
            mediaIndex += 1;
            media.push({
              kind: "image",
              src,
              filename: `img_${String(mediaIndex).padStart(3, "0")}.jpg`,
            });
          }

          for (const v of row.querySelectorAll("video")) {
            const src = v.currentSrc || v.src || v.querySelector("source")?.src || "";
            mediaIndex += 1;
            media.push({
              kind: "video",
              src,
              poster: v.poster || "",
              filename: `video_${String(mediaIndex).padStart(3, "0")}.mp4`,
            });
          }

          for (const a of row.querySelectorAll("audio")) {
            const src = a.currentSrc || a.src || a.querySelector("source")?.src || "";
            if (!src) continue;
            mediaIndex += 1;
            media.push({
              kind: "audio",
              src,
              filename: `audio_${String(mediaIndex).padStart(3, "0")}.ogg`,
            });
          }

          const docs = row.querySelectorAll(
            'a[download], [data-testid="media-document"] a, [data-testid="media-document"] span[title]'
          );
          docs.forEach((d, i) => {
            const href = d.getAttribute("href") || d.closest("a")?.getAttribute("href") || "";
            const name =
              d.getAttribute("download") ||
              d.getAttribute("title") ||
              textOf(d).split("\n")[0] ||
              `doc_${i}`;
            mediaIndex += 1;
            media.push({
              kind: "document",
              src: href,
              filename: name.includes(".") ? name : `doc_${mediaIndex}.bin`,
            });
          });
        }

        // skip pure noise (no text, no media)
        if (!text && !media.length) continue;

        const reactionEl = row.querySelector('[data-testid="reaction"]') || null;

        messages.push({
          id: dataId || `auto-${messages.length}`,
          direction,
          sender: parseSender(row, direction === "out"),
          time: parseTime(row),
          text,
          media,
          reactions: reactionEl ? textOf(reactionEl) : "",
          hasMedia: media.length > 0,
        });
      }

      return messages;
    },

    async primeVideos() {
      const videos = Array.from(document.querySelectorAll("video"));
      for (const v of videos) {
        try {
          v.muted = true;
          const p = v.play();
          if (p && p.then) await p.catch(() => {});
        } catch {
          /* ignore */
        }
      }
      await WADOM.sleep(600);
      for (const v of videos) {
        try {
          v.pause();
        } catch {
          /* ignore */
        }
      }
    },

    async resolveMediaBlobs(messages, onProgress) {
      let total = 0;
      for (const m of messages) total += m.media.length;
      if (total && messages.some((m) => m.media.some((x) => x.kind === "video"))) {
        await this.primeVideos();
      }

      let done = 0;
      for (const m of messages) {
        for (const media of m.media) {
          done += 1;
          if (onProgress) onProgress(done, total, media.filename);

          if (media.kind === "video" && !media.src) {
            const live = Array.from(document.querySelectorAll("video")).find((v) => {
              const s = v.currentSrc || v.src || "";
              return s && (!media.poster || v.poster === media.poster);
            });
            if (live) media.src = live.currentSrc || live.src || "";
          }

          if (!media.src) {
            if (media.poster) {
              const pb = await blobFromUrl(media.poster);
              if (pb) {
                media.blob = pb;
                media.mime = pb.type || "image/jpeg";
                media.filename = media.filename.replace(/\.[^.]+$/, "") + "_poster.jpg";
                media.kind = "image";
                media.note = "video poster (video blob unavailable)";
              }
            }
            continue;
          }

          const blob = await blobFromUrl(media.src);
          if (blob) {
            media.blob = blob;
            media.mime = blob.type || "";
            const ext = extFromMime(blob.type, media.filename.split(".").pop());
            const base = media.filename.replace(/\.[^.]+$/, "");
            media.filename = `${base}.${ext}`;
          } else if (media.poster) {
            const pb = await blobFromUrl(media.poster);
            if (pb) {
              media.blob = pb;
              media.mime = pb.type || "image/jpeg";
              media.filename = media.filename.replace(/\.[^.]+$/, "") + "_poster.jpg";
              media.kind = "image";
              media.note = "video poster (video blob unavailable)";
            }
          }
        }
      }
      return messages;
    },
  };

  global.WAParser = WAParser;
})(typeof self !== "undefined" ? self : globalThis);
