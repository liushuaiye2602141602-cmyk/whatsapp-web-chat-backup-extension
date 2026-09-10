/**
 * Export Markdown / ZIP from WPP-normalized messages.
 */
(function (global) {
  "use strict";

  function safeFilename(name) {
    return (
      String(name || "chat")
        .replace(/[\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "chat"
    );
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function formatTime(ms) {
    if (!ms) return "";
    const d = new Date(Number(ms));
    if (Number.isNaN(d.getTime())) return String(ms);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function formatNow() {
    return formatTime(Date.now());
  }

  function whoLabel(m) {
    if (m.fromMe) return "我";
    return m.displayName || m.formattedName || m.phone || "联系人";
  }

  function mediaKindLabel(m) {
    if (m.isImage) return "image";
    if (m.isVideo) return "video";
    if (m.isAudio) return "audio";
    if (m.isDocument) return "document";
    return m.type || "file";
  }

  function defaultExt(m) {
    const k = mediaKindLabel(m);
    if (k === "image") return "jpg";
    if (k === "video") return "mp4";
    if (k === "audio") return "ogg";
    return "bin";
  }

  function mediaFilename(m, index) {
    if (m.filename && m.filename.includes(".")) return m.filename;
    return `${mediaKindLabel(m)}_${String(index).padStart(3, "0")}.${defaultExt(m)}`;
  }

  function buildMarkdownHeader(chat, messages, mediaCount) {
    const title = chat.title || chat.chatName || "WhatsApp Chat";
    const rows = [
      ["聊天", title],
      ["Chat ID", chat.chatId || chat.id || ""],
      ["导出时间", formatNow()],
      ["消息数", String(messages.length)],
      ["媒体数", String(mediaCount)],
    ];
    const md = [
      `# ${title}`,
      "",
      "| 项目 | 内容 |",
      "| --- | --- |",
      ...rows.map(([k, v]) => `| ${k} | ${String(v).replace(/\|/g, "\\|")} |`),
      "",
      "---",
      "",
    ];
    return md.join("\n");
  }

  function messageMarkdown(m, mediaMode, filename) {
    const lines = [];
    const who = whoLabel(m);
    const time = formatTime(m.time);
    lines.push(`**${who} · ${time}**`);
    lines.push("");

    const body = (m.message || m.caption || "").trim();
    if (body) lines.push(body);

    if (m.isMedia || m._rawHasMedia) {
      const name = filename || mediaFilename(m, 0);
      if (mediaMode === "relative") {
        if (mediaKindLabel(m) === "image") lines.push(`![${name}](media/${name})`);
        else if (mediaKindLabel(m) === "video") lines.push(`📹 [${name}](media/${name})`);
        else if (mediaKindLabel(m) === "audio") lines.push(`🎧 [${name}](media/${name})`);
        else lines.push(`📎 [${name}](media/${name})`);
      } else {
        const icon =
          mediaKindLabel(m) === "image"
            ? "📷 图片"
            : mediaKindLabel(m) === "video"
              ? "📹 视频"
              : mediaKindLabel(m) === "audio"
                ? "🎧 语音"
                : "📎 文件";
        lines.push(`${icon}: \`${name}\``);
      }
    }

    if (m.reactions && m.reactions.length) {
      const rx = m.reactions
        .map((r) => `${r.text}${r.senders && r.senders.length ? "(" + r.senders.join(",") + ")" : ""}`)
        .join(" ");
      lines.push("");
      lines.push(`> 反应: ${rx}`);
    }

    return lines.join("\n");
  }

  const WAExporter = {
    safeFilename,
    downloadBlob,
    formatTime,

    toMarkdown(chat, messages, opts = {}) {
      const mediaMode = opts.mediaMode || "names";
      const mediaCount = messages.reduce(
        (n, m) => n + (m.isMedia || m._rawHasMedia ? 1 : 0),
        0
      );
      const parts = [buildMarkdownHeader(chat, messages, mediaCount)];
      if (opts.subtitle) {
        parts.push(`> ${opts.subtitle}`, "");
        parts.push("---", "");
      }
      let mediaIdx = 0;
      for (const m of messages) {
        if (m.isMedia || m._rawHasMedia) mediaIdx += 1;
        parts.push(
          messageMarkdown(
            m,
            mediaMode,
            m.isMedia || m._rawHasMedia ? mediaFilename(m, mediaIdx) : null
          )
        );
        parts.push("", "---", "");
      }
      parts.push(`_由 WA Chats Backup Pro 导出 · ${formatNow()}_`);
      return parts.join("\n");
    },

    toTxt(chat, messages) {
      const lines = [
        `Chat: ${chat.title || chat.chatName}`,
        `Exported: ${formatNow()}`,
        `Messages: ${messages.length}`,
        "=".repeat(48),
        "",
      ];
      for (const m of messages) {
        lines.push(`[${formatTime(m.time) || "?"}] ${whoLabel(m)}:`);
        if (m.message || m.caption) lines.push(m.message || m.caption);
        if (m.isMedia || m._rawHasMedia) lines.push(`  <${mediaKindLabel(m)}> ${mediaFilename(m, 0)}`);
        if (m.reactions && m.reactions.length) {
          lines.push("  reactions: " + m.reactions.map((r) => r.text).join(" "));
        }
        lines.push("");
      }
      return lines.join("\n");
    },

    toJson(chat, messages) {
      return JSON.stringify(
        {
          chat: {
            title: chat.title || chat.chatName,
            chatId: chat.chatId || chat.id || null,
            exportedAt: new Date().toISOString(),
          },
          messages: messages.map((m) => ({
            id: m.id,
            fromMe: !!m.fromMe,
            sender: whoLabel(m),
            time: m.time || null,
            type: m.type,
            text: m.message || m.caption || "",
            reactions: m.reactions || [],
            isMedia: !!(m.isMedia || m._rawHasMedia),
            filename: m.filename || null,
          })),
        },
        null,
        2
      );
    },

    /**
     * @param {Array} mediaFiles [{filename, blob}]
     */
    async toZip(chat, messages, mediaFiles, onProgress) {
      const zip = new WAZip.ZipWriter();
      const base = safeFilename(chat.title || chat.chatName);
      if (onProgress) onProgress("构建 Markdown…", 0, 1);
      const md = this.toMarkdown(chat, messages, {
        mediaMode: "relative",
        subtitle: "媒体文件见 `media/` 目录。",
      });
      await zip.add(`${base}/chat.md`, md);

      const used = new Set();
      let i = 0;
      const files = mediaFiles || [];
      for (const f of files) {
        i += 1;
        if (onProgress) onProgress(`打包 ${f.filename}`, i, files.length);
        if (!f.blob) continue;
        let name = f.filename || `file_${i}.bin`;
        if (used.has(name)) {
          const dot = name.lastIndexOf(".");
          const stem = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : "";
          name = `${stem}_${i}${ext}`;
        }
        used.add(name);
        await zip.add(`${base}/media/${name}`, f.blob);
      }
      if (onProgress) onProgress("生成 ZIP…", files.length, files.length);
      return zip.build();
    },

    /**
     * WPP media result → Blob
     * downloadMedia may return: Blob | {data,mimetype} | data URL string | null
     */
    mediaResultToBlob(result) {
      if (!result) return null;
      if (result instanceof Blob) return result;
      if (typeof result === "string") {
        if (result.startsWith("data:")) {
          try {
            const [head, b64] = result.split(",");
            const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], { type: mime });
          } catch {
            return null;
          }
        }
        return null;
      }
      if (result.data) {
        let b64 = result.data;
        if (b64.startsWith("data:")) b64 = b64.split(",")[1];
        try {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return new Blob([arr], { type: result.mimetype || result.mimeType || "application/octet-stream" });
        } catch {
          return null;
        }
      }
      return null;
    },

    async fetchMediaForMessages(messages, onProgress) {
      const files = [];
      const mediaMsgs = messages.filter((m) => m.isMedia || m._rawHasMedia);
      let i = 0;
      for (const m of mediaMsgs) {
        i += 1;
        if (onProgress) onProgress(`下载媒体 ${i}/${mediaMsgs.length}`, i, mediaMsgs.length);
        if (!m.id) continue;
        let result = null;
        try {
          result = await WABridge.downloadMedia(m.id);
        } catch {
          result = null;
        }
        const blob = this.mediaResultToBlob(result);
        if (!blob) {
          files.push({ filename: mediaFilename(m, i), blob: null, missing: true });
          continue;
        }
        // pick extension from mime
        let name = mediaFilename(m, i);
        if (blob.type) {
          const sub = blob.type.split("/")[1] || "";
          const map = { jpeg: "jpg", "png": "png", "webp": "webp", "mp4": "mp4", ogg: "ogg", "3gpp": "3gp" };
          const ext = map[sub] || sub.split("+")[0] || name.split(".").pop();
          name = name.replace(/\.[^.]+$/, "") + "." + ext;
        }
        files.push({ filename: name, blob });
      }
      return files;
    },

    /**
     * Export one or more chats fetched via WPP bridge.
     * @param {Array} chats [{id, name}]
     * @param {object} opts { formats, includeMedia }
     */
    async exportChats(chats, opts, onProgress) {
      const formats = opts.formats || ["md", "zip"];
      const includeMedia = opts.includeMedia !== false;
      const results = [];

      if (onProgress) onProgress("等待 WPP 就绪…");
      const ok = await WABridge.waitReady(opts.readyTimeoutMs || 25000);
      if (!ok) {
        results.push({
          chat: "-",
          file: null,
          messages: 0,
          error: "WPP 未就绪：请确认已登录 WhatsApp Web 并刷新页面后重试",
        });
        return results;
      }

      if (onProgress) onProgress("读取消息…");
      let bundles;
      try {
        bundles = await WABridge.getMessages(chats, -1);
      } catch (e) {
        results.push({
          chat: "-",
          file: null,
          messages: 0,
          error: "getMessages 失败: " + e,
        });
        return results;
      }
      if (!bundles || !bundles.length) {
        results.push({
          chat: "-",
          file: null,
          messages: 0,
          error: "WPP 返回空消息列表",
        });
        return results;
      }

      for (const bundle of bundles) {
        const chatMeta = { title: bundle.chatName, chatId: bundle.chatId, id: bundle.chatId };
        let messages = bundle.items || [];
        const base = safeFilename(bundle.chatName);
        const stamp = new Date().toISOString().slice(0, 10);

        if (!messages.length) {
          results.push({
            chat: bundle.chatName,
            file: null,
            messages: 0,
            error: "该聊天无消息",
          });
          continue;
        }

        let mediaFiles = [];
        if (includeMedia) {
          if (onProgress) onProgress(`${bundle.chatName}: 下载媒体…`);
          mediaFiles = await this.fetchMediaForMessages(messages, (msg, d, t) => {
            if (onProgress) onProgress(`${bundle.chatName}: ${msg}`);
          });
        } else {
          messages = messages.map((m) => ({ ...m, isMedia: false, _rawHasMedia: false }));
        }

        if (formats.includes("md")) {
          const md = this.toMarkdown(chatMeta, messages, { mediaMode: "names" });
          const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
          downloadBlob(blob, `${base}_${stamp}.md`);
          results.push({ chat: bundle.chatName, file: `${base}_${stamp}.md`, messages: messages.length });
        }

        if (formats.includes("txt")) {
          const blob = new Blob([this.toTxt(chatMeta, messages)], {
            type: "text/plain;charset=utf-8",
          });
          downloadBlob(blob, `${base}_${stamp}.txt`);
          results.push({ chat: bundle.chatName, file: `${base}_${stamp}.txt`, messages: messages.length });
        }

        if (formats.includes("json")) {
          const blob = new Blob([this.toJson(chatMeta, messages)], { type: "application/json" });
          downloadBlob(blob, `${base}_${stamp}.json`);
          results.push({ chat: bundle.chatName, file: `${base}_${stamp}.json`, messages: messages.length });
        }

        if (formats.includes("zip")) {
          const zipBlob = await this.toZip(chatMeta, messages, mediaFiles, (msg, d, t) => {
            if (onProgress) onProgress(`${bundle.chatName}: ${msg}`);
          });
          downloadBlob(zipBlob, `${base}_${stamp}_backup.zip`);
          results.push({
            chat: bundle.chatName,
            file: `${base}_${stamp}_backup.zip`,
            messages: messages.length,
            media: mediaFiles.filter((f) => f.blob).length,
          });
        }
      }

      return results;
    },
  };

  global.WAExporter = WAExporter;
})(typeof self !== "undefined" ? self : globalThis);
