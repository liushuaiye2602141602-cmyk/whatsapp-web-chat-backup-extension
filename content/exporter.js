/**
 * Export builders: Markdown (primary) / ZIP (md + media) / optional JSON & TXT.
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

  function formatNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function normalizeTime(t) {
    if (!t) return "";
    // [19:40, 8/12/2026] → 2026/8/12 19:40
    const bracket = String(t).match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)[,\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})\]?/);
    if (bracket) {
      const [, time, mo, dy, yr] = bracket;
      return `${yr}/${mo}/${dy} ${time}`;
    }
    // ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(String(t))) {
      try {
        const d = new Date(t);
        if (!Number.isNaN(d.getTime())) return formatDateTime(d);
      } catch {
        /* ignore */
      }
    }
    return String(t).replace(/^\[|\]$/g, "").trim();
  }

  function formatDateTime(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function whoLabel(m) {
    if (m.direction === "out") return "我";
    return m.sender || "联系人";
  }

  function mdEscape(text) {
    // Keep readability; only neutralize pathological control chars
    return String(text ?? "").replace(/\r\n/g, "\n");
  }

  /**
   * Markdown body for one message.
   * @param {object} mediaMode 'relative' | 'names' | 'embed'
   */
  function messageMarkdown(m, mediaMode) {
    const lines = [];
    const who = whoLabel(m);
    const time = normalizeTime(m.time);
    const stamp = time ? `${who} · ${time}` : who;

    lines.push(`**${stamp}**`);
    lines.push("");

    if (m.text) {
      // indent multi-line as plain paragraph content
      lines.push(mdEscape(m.text));
    }

    for (const media of m.media) {
      if (mediaMode === "relative") {
        const path = `media/${media.filename}`;
        if (media.kind === "image") {
          lines.push(`![${media.filename}](${path})`);
        } else if (media.kind === "video") {
          lines.push(`📹 [${media.filename}](${path})`);
        } else if (media.kind === "audio") {
          lines.push(`🎧 [${media.filename}](${path})`);
        } else {
          lines.push(`📎 [${media.filename}](${path})`);
        }
        if (media.note) lines.push(`<!-- ${media.note} -->`);
      } else if (mediaMode === "embed" && media.blob && media.kind === "image" && media.blob.size < 1_500_000) {
        // async handled by caller when needed — here just name
        lines.push(`📷 ${media.filename}`);
      } else {
        if (media.kind === "image") lines.push(`📷 图片: \`${media.filename}\``);
        else if (media.kind === "video") lines.push(`📹 视频: \`${media.filename}\``);
        else if (media.kind === "audio") lines.push(`🎧 语音: \`${media.filename}\``);
        else lines.push(`📎 文件: \`${media.filename}\``);
        if (media.note) lines.push(`   _(${media.note})_`);
      }
    }

    if (m.reactions) {
      lines.push("");
      lines.push(`> 反应: ${mdEscape(m.reactions)}`);
    }

    return lines.join("\n");
  }

  function buildMarkdownHeader(chat, messages, opts = {}) {
    const title = chat.title || "WhatsApp Chat";
    const chatId = chat.chatId || chat.title || "";
    const exported = formatNow();
    const mediaCount = messages.reduce((n, m) => n + (m.media?.length || 0), 0);

    const rows = [
      ["聊天", title],
      ["Chat ID", chatId],
      ["导出时间", exported],
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
    if (opts.subtitle) {
      md.splice(1, 0, `> ${opts.subtitle}`, "");
    }
    return md.join("\n");
  }

  const WAExporter = {
    safeFilename,
    downloadBlob,
    formatNow,

    /**
     * Primary export: Markdown transcript (like Chats Backup reference fields).
     * @param {object} chat
     * @param {Array} messages
     * @param {object} opts { mediaMode: 'relative'|'names', subtitle }
     */
    toMarkdown(chat, messages, opts = {}) {
      const mediaMode = opts.mediaMode || "names";
      const parts = [buildMarkdownHeader(chat, messages, opts)];

      for (const m of messages) {
        parts.push(messageMarkdown(m, mediaMode));
        parts.push("");
        parts.push("---");
        parts.push("");
      }

      parts.push(`_由 WA Chats Backup Pro 导出 · ${formatNow()}_`);
      return parts.join("\n");
    },

    toTxt(chat, messages) {
      const lines = [
        `Chat: ${chat.title}`,
        `Exported: ${formatNow()}`,
        `Messages: ${messages.length}`,
        "=".repeat(48),
        "",
      ];
      for (const m of messages) {
        lines.push(`[${normalizeTime(m.time) || "?"}] ${whoLabel(m)}:`);
        if (m.text) lines.push(m.text);
        for (const media of m.media) {
          lines.push(`  <${media.kind}> ${media.filename}`);
        }
        if (m.reactions) lines.push(`  reactions: ${m.reactions}`);
        lines.push("");
      }
      return lines.join("\n");
    },

    toJson(chat, messages) {
      return JSON.stringify(
        {
          chat: {
            title: chat.title,
            chatId: chat.chatId || null,
            exportedAt: new Date().toISOString(),
          },
          messages: messages.map((m) => ({
            id: m.id,
            direction: m.direction,
            sender: m.sender,
            time: normalizeTime(m.time),
            text: m.text,
            reactions: m.reactions,
            media: m.media.map((x) => ({
              kind: x.kind,
              filename: x.filename,
              mime: x.mime || null,
              hasBlob: !!x.blob,
              note: x.note || null,
            })),
          })),
        },
        null,
        2
      );
    },

    /**
     * ZIP: chat.md (relative media links) + media files.
     */
    async toZip(chat, messages, onProgress) {
      const zip = new WAZip.ZipWriter();
      const base = safeFilename(chat.title);

      if (onProgress) onProgress("Building Markdown…", 0, 1);
      const md = this.toMarkdown(chat, messages, {
        mediaMode: "relative",
        subtitle: "媒体文件见 `media/` 目录，图片在预览器中可点击打开。",
      });
      await zip.add(`${base}/chat.md`, md);

      let i = 0;
      let total = 0;
      for (const m of messages) total += m.media.length;

      const used = new Set();
      const missing = [];
      for (const m of messages) {
        for (const media of m.media) {
          i += 1;
          if (onProgress) onProgress(`Packing ${media.filename}`, 1 + i, 1 + total);
          if (!media.blob) {
            missing.push(`- ${media.kind} ${media.filename}`);
            continue;
          }
          let name = media.filename || `file_${i}.bin`;
          if (used.has(name)) {
            const dot = name.lastIndexOf(".");
            const stem = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : "";
            name = `${stem}_${i}${ext}`;
          }
          used.add(name);
          await zip.add(`${base}/media/${name}`, media.blob);
        }
      }

      if (missing.length) {
        await zip.add(
          `${base}/media/_missing.txt`,
          `Missing media (${missing.length}):\n${missing.join("\n")}\n`
        );
      }

      if (onProgress) onProgress("Creating ZIP…", 1 + total, 1 + total);
      return zip.build();
    },

    /**
     * Export chats. Default format is Markdown.
     * @param {Array} chats
     * @param {object} opts { formats: ['md','zip','json','txt'], includeMedia, includeVideo, scrollRounds }
     */
    async exportChats(chats, opts, onProgress) {
      const results = [];
      const formats = opts.formats || ["md", "zip"];
      const includeMedia = opts.includeMedia !== false;

      for (let ci = 0; ci < chats.length; ci++) {
        const chat = chats[ci];
        const label = `[${ci + 1}/${chats.length}] ${chat.title}`;
        if (onProgress) onProgress(`${label}: opening…`);

        if (chat.listItemEl) {
          await WADOM.clickChat(chat.listItemEl);
        }
        await WADOM.sleep(900);

        if (onProgress) onProgress(`${label}: loading history…`);
        const merged = new Map();

        await WADOM.walkChatHistory({
          maxSteps: opts.scrollRounds ?? 60,
          stepPx: 700,
          delay: 400,
          onChunk: async (step) => {
            if (onProgress) onProgress(`${label}: scanning window ${step}… (${merged.size} msgs)`);
            const chunk = await WAParser.parseConversation({ includeMedia: true });
            for (const msg of chunk) {
              const key = msg.id || `${msg.direction}|${msg.time}|${msg.text}|${msg.sender}`;
              if (merged.has(key)) continue;
              if (includeMedia && msg.media.length) {
                await WAParser.resolveMediaBlobs([msg], () => {});
              }
              merged.set(key, { msg, step, order: merged.size });
            }
          },
        });

        let messages = Array.from(merged.values())
          .sort((a, b) => {
            if (b.step !== a.step) return b.step - a.step;
            return a.order - b.order;
          })
          .map((x) => x.msg);

        if (!messages.length) {
          // last chance: parse whatever is on screen without walk
          messages = await WAParser.parseConversation({ includeMedia: true });
        }

        if (!messages.length) {
          let diag = "";
          try {
            const d = WAParser.diagnose();
            diag = `nodes=${d.messageNodes} main=${d.main} header=${d.header} scroller=${d.hasScroller} title=${d.title || "-"}`;
          } catch (e) {
            diag = String(e);
          }
          if (onProgress) {
            onProgress(`${label}: 解析到 0 条消息。${diag}`);
          }
          results.push({
            chat: chat.title,
            file: null,
            messages: 0,
            error: "解析到 0 条消息，请先点开聊天并刷新页面后重试。诊断: " + diag,
          });
          continue;
        }

        if (!includeMedia) {
          messages = messages.map((m) => ({ ...m, media: [], hasMedia: false }));
        } else if (opts.includeVideo === false) {
          messages = messages.map((m) => ({
            ...m,
            media: m.media.filter((x) => x.kind !== "video"),
          }));
        }

        const unresolved = messages.filter((m) => m.media.some((x) => !x.blob && x.src));
        if (includeMedia && unresolved.length) {
          if (onProgress) onProgress(`${label}: finalizing media…`);
          await WAParser.resolveMediaBlobs(unresolved, (d, t, fn) => {
            if (onProgress) onProgress(`${label}: media ${d}/${t} ${fn}`);
          });
        }

        const chatMeta = {
          title: chat.title,
          chatId: chat.chatId || null,
        };

        // enrich chatId from DOM if missing
        if (!chatMeta.chatId) {
          try {
            const header = document.querySelector("#main header");
            const sub =
              header?.querySelector('span[dir="auto"][class*="selectable"]') ||
              header?.querySelectorAll("span[dir='auto']")[1];
            const maybe = (sub?.textContent || "").trim();
            if (maybe && maybe !== chat.title) chatMeta.chatId = maybe;
          } catch {
            /* ignore */
          }
        }

        const base = safeFilename(chat.title);
        const stamp = new Date().toISOString().slice(0, 10);

        if (formats.includes("md")) {
          const md = this.toMarkdown(chatMeta, messages, {
            mediaMode: "names",
            subtitle: includeMedia
              ? "媒体文件请使用 ZIP 导出以获得完整图片/视频；本文件仅列出文件名。"
              : "未包含媒体文件。",
          });
          const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
          downloadBlob(blob, `${base}_${stamp}.md`);
          results.push({ chat: chat.title, file: `${base}_${stamp}.md`, messages: messages.length });
        }

        if (formats.includes("txt")) {
          const blob = new Blob([this.toTxt(chatMeta, messages)], {
            type: "text/plain;charset=utf-8",
          });
          downloadBlob(blob, `${base}_${stamp}.txt`);
          results.push({ chat: chat.title, file: `${base}_${stamp}.txt`, messages: messages.length });
        }

        if (formats.includes("json")) {
          const blob = new Blob([this.toJson(chatMeta, messages)], { type: "application/json" });
          downloadBlob(blob, `${base}_${stamp}.json`);
          results.push({ chat: chat.title, file: `${base}_${stamp}.json`, messages: messages.length });
        }

        if (formats.includes("zip")) {
          const zipBlob = await this.toZip(chatMeta, messages, (msg, d, t) => {
            if (onProgress) onProgress(`${label}: ${msg}`);
          });
          downloadBlob(zipBlob, `${base}_${stamp}_backup.zip`);
          results.push({
            chat: chat.title,
            file: `${base}_${stamp}_backup.zip`,
            messages: messages.length,
          });
        }

        await WADOM.sleep(400);
      }

      return results;
    },
  };

  global.WAExporter = WAExporter;
})(typeof self !== "undefined" ? self : globalThis);
