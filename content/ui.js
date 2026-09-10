/**
 * Injected UI: toolbar button + side panel (chat list + export controls).
 */
(function (global) {
  "use strict";

  const STATE = {
    open: false,
    chats: [],
    selected: new Set(),
    busy: false,
    progress: "",
    formats: { md: true, zip: true, txt: false, json: false },
    includeMedia: true,
    includeVideo: true,
    scrollRounds: 60,
  };

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  const WAUI = {
    state: STATE,
    panel: null,
    toolbarBtn: null,

    ensureToolbarButton() {
      if (this.toolbarBtn && document.contains(this.toolbarBtn)) return;

      const header =
        document.querySelector("#main header") ||
        document.querySelector('[data-testid="conversation-header"]') ||
        document.querySelector("header");

      if (!header) return;

      // Prefer the right-side action cluster (video call / more)
      let action = null;
      const buttons = Array.from(header.querySelectorAll('[role="button"], button, div[title]'));
      // pick last cluster parent that contains multiple interactive icons
      const parents = new Map();
      for (const b of buttons) {
        const p = b.parentElement;
        if (!p) continue;
        parents.set(p, (parents.get(p) || 0) + 1);
      }
      const ranked = [...parents.entries()].sort((a, b) => b[1] - a[1]);
      if (ranked.length) action = ranked[0][0];

      if (!action) {
        action =
          header.querySelector('[role="button"]')?.parentElement ||
          header.querySelector("div[title]")?.parentElement ||
          header;
      }

      const btn = el("button", {
        type: "button",
        class: "wabk-toolbar-btn",
        title: "WA Chats Backup Pro — export this chat",
        "aria-label": "WA Chats Backup Pro",
        onclick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.togglePanel();
        },
      });
      btn.innerHTML = `
        <span class="wabk-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.6z"/>
          </svg>
        </span>
      `;
      btn.classList.add("wabk-green");

      try {
        // insert near the end of the action row so it sits with call/more icons
        if (action.childNodes.length) action.insertBefore(btn, action.lastChild);
        else action.appendChild(btn);
      } catch {
        try {
          header.appendChild(btn);
        } catch {
          /* ignore */
        }
      }
      this.toolbarBtn = btn;
    },

    buildPanel() {
      if (this.panel && document.contains(this.panel)) return this.panel;

      const panel = el("aside", { class: "wabk-panel", id: "wabk-panel", "data-open": "false" });

      panel.innerHTML = `
        <div class="wabk-header">
          <div class="wabk-title">
            <span class="wabk-brand">WA Chats Backup</span>
            <span class="wabk-badge">Pro</span>
          </div>
          <button type="button" class="wabk-close" title="Close" aria-label="Close">×</button>
        </div>
        <div class="wabk-banner">
          打开 <b>web.whatsapp.com</b> 并等待聊天加载完成。点击聊天标题栏的绿色时钟按钮，或通过扩展图标打开面板。默认导出 <b>Markdown (.md)</b>。
        </div>
        <div class="wabk-body">
          <section class="wabk-col wabk-chats">
            <div class="wabk-section-title">选择聊天 <small>（可多选）</small></div>
            <div class="wabk-chat-list" id="wabk-chat-list" role="listbox" aria-multiselectable="true"></div>
            <div class="wabk-list-actions">
              <button type="button" data-act="active">当前聊天</button>
              <button type="button" data-act="all">全选</button>
              <button type="button" data-act="none">清空</button>
              <button type="button" data-act="refresh">刷新</button>
            </div>
            <p class="wabk-hint">💡 列表为空时，请刷新网页后再试。</p>
          </section>
          <section class="wabk-col wabk-options">
            <div class="wabk-section-title">导出格式</div>
            <div class="wabk-formats">
              <label><input type="checkbox" name="fmt" value="md" checked> Markdown (.md) 推荐</label>
              <label><input type="checkbox" name="fmt" value="zip" checked> ZIP（chat.md + 图片/视频）</label>
              <label><input type="checkbox" name="fmt" value="txt"> TXT</label>
              <label><input type="checkbox" name="fmt" value="json"> JSON</label>
            </div>
            <div class="wabk-toggles">
              <label><input type="checkbox" id="wabk-media" checked> 包含图片与视频</label>
              <label><input type="checkbox" id="wabk-video" checked> 下载视频文件</label>
              <label class="wabk-scroll-row">
                历史加载轮次
                <input type="number" id="wabk-scroll" min="5" max="200" value="60">
              </label>
            </div>
            <button type="button" class="wabk-export-btn" id="wabk-export">导出所选</button>
            <button type="button" class="wabk-export-btn ghost" id="wabk-export-active">导出当前聊天</button>
            <button type="button" class="wabk-export-btn ghost" id="wabk-diag" style="margin-top:4px">诊断当前聊天</button>
            <div class="wabk-progress" id="wabk-progress" hidden></div>
            <div class="wabk-log" id="wabk-log"></div>
          </section>
        </div>
      `;

      document.body.appendChild(panel);

      panel.querySelector(".wabk-close").addEventListener("click", () => this.setOpen(false));
      panel.querySelectorAll('[data-act]').forEach((btn) => {
        btn.addEventListener("click", () => this.listAction(btn.getAttribute("data-act")));
      });
      panel.querySelectorAll('input[name="fmt"]').forEach((cb) => {
        cb.addEventListener("change", () => {
          STATE.formats[cb.value] = cb.checked;
        });
      });
      panel.querySelector("#wabk-media").addEventListener("change", (e) => {
        STATE.includeMedia = e.target.checked;
      });
      panel.querySelector("#wabk-video").addEventListener("change", (e) => {
        STATE.includeVideo = e.target.checked;
      });
      panel.querySelector("#wabk-scroll").addEventListener("change", (e) => {
        STATE.scrollRounds = Math.max(5, Math.min(200, Number(e.target.value) || 60));
      });
      panel.querySelector("#wabk-export").addEventListener("click", () => this.startExport(false));
      panel.querySelector("#wabk-export-active").addEventListener("click", () => this.startExport(true));
      panel.querySelector("#wabk-diag").addEventListener("click", () => this.runDiagnose());

      this.panel = panel;
      return panel;
    },

    setOpen(open) {
      STATE.open = open;
      const panel = this.buildPanel();
      panel.setAttribute("data-open", open ? "true" : "false");
      document.documentElement.setAttribute("data-wabk-open", open ? "true" : "false");
      if (open) this.refreshChats();
    },

    togglePanel() {
      this.setOpen(!STATE.open);
    },

    listAction(act) {
      if (act === "refresh") return this.refreshChats();
      if (act === "none") {
        STATE.selected.clear();
        return this.renderChatList();
      }
      if (act === "all") {
        STATE.chats.forEach((c, i) => STATE.selected.add(c.key || String(i)));
        return this.renderChatList();
      }
      if (act === "active") {
        const title = WADOM.getActiveChatTitle();
        const hit = STATE.chats.find((c) => c.title === title);
        if (hit) {
          STATE.selected.clear();
          STATE.selected.add(hit.key);
        } else if (title) {
          STATE.chats.unshift({
            key: `active-${title}`,
            title,
            preview: "",
            time: "now",
            active: true,
            listItemEl: null,
          });
          STATE.selected.clear();
          STATE.selected.add(STATE.chats[0].key);
        }
        return this.renderChatList();
      }
    },

    refreshChats() {
      const items = WADOM.getChatListItems();
      const chats = [];
      const seen = new Set();
      items.forEach((el, idx) => {
        const info = WADOM.getChatInfoFromListItem(el);
        const key = `${info.title}|${idx}`;
        if (seen.has(info.title)) return;
        seen.add(info.title);
        chats.push({ ...info, key });
      });

      // Always include active chat
      const active = WADOM.getActiveChatTitle();
      if (active && !seen.has(active)) {
        chats.unshift({ key: `active-${active}`, title: active, preview: "", time: "now", active: true, listItemEl: null });
      }

      STATE.chats = chats;
      // keep selection that still exists
      const keys = new Set(chats.map((c) => c.key));
      for (const k of [...STATE.selected]) {
        if (!keys.has(k) && !chats.some((c) => c.title === k)) {
          // allow title-based keep
          const still = chats.find((c) => c.title === k);
          if (still) {
            STATE.selected.delete(k);
            STATE.selected.add(still.key);
          } else STATE.selected.delete(k);
        }
      }
      this.renderChatList();
      this.log(`Loaded ${chats.length} chats`);
    },

    renderChatList() {
      const list = document.getElementById("wabk-chat-list");
      if (!list) return;
      list.innerHTML = "";
      if (!STATE.chats.length) {
        list.appendChild(el("div", { class: "wabk-empty", text: "未找到聊天，请刷新 WhatsApp Web。" }));
        return;
      }
      for (const chat of STATE.chats) {
        const selected = STATE.selected.has(chat.key);
        const row = el("div", {
          class: `wabk-chat-row${selected ? " selected" : ""}${chat.active ? " active" : ""}`,
          role: "option",
          "aria-selected": selected ? "true" : "false",
          onclick: () => {
            if (STATE.selected.has(chat.key)) STATE.selected.delete(chat.key);
            else STATE.selected.add(chat.key);
            this.renderChatList();
          },
        });
        row.innerHTML = `
          <span class="wabk-radio" aria-hidden="true"></span>
          <span class="wabk-chat-title" title="${escapeAttr(chat.title)}">${escapeHtml(chat.title)}</span>
          <span class="wabk-chat-meta">${escapeHtml(chat.time || "")}</span>
        `;
        list.appendChild(row);
      }
    },

    log(msg) {
      const box = this.panel?.querySelector("#wabk-log");
      if (!box) return;
      const line = el("div", { class: "wabk-log-line", text: msg });
      box.prepend(line);
      while (box.children.length > 40) box.lastChild.remove();
    },

    setProgress(msg) {
      const p = this.panel?.querySelector("#wabk-progress");
      if (!p) return;
      if (!msg) {
        p.hidden = true;
        p.textContent = "";
      } else {
        p.hidden = false;
        p.textContent = msg;
      }
      STATE.progress = msg;
    },

    async startExport(onlyActive) {
      if (STATE.busy) return;
      let targets;
      if (onlyActive) {
        const title = WADOM.getActiveChatTitle();
        const found = STATE.chats.find((c) => c.title === title);
        targets = [
          found || {
            key: `active-${title || "chat"}`,
            title: title || "Current Chat",
            listItemEl: null,
          },
        ];
      } else {
        targets = STATE.chats.filter((c) => STATE.selected.has(c.key));
      }

      if (!targets.length) {
        this.log("请至少选择一个聊天。");
        this.setProgress("未选择聊天");
        return;
      }

      const formats = Object.keys(STATE.formats).filter((k) => STATE.formats[k]);
      if (!formats.length) {
        this.log("Choose at least one export format.");
        return;
      }

      STATE.busy = true;
      const exportBtn = this.panel.querySelector("#wabk-export");
      exportBtn.disabled = true;
      exportBtn.textContent = "导出中…";

      try {
        this.setProgress(`正在导出 ${targets.length} 个聊天…`);
        const results = await WAExporter.exportChats(
          targets,
          {
            formats,
            includeMedia: STATE.includeMedia,
            includeVideo: STATE.includeVideo,
            scrollRounds: STATE.scrollRounds,
          },
          (msg) => {
            this.setProgress(msg);
            this.log(msg);
          }
        );
        this.setProgress("Done");
        this.log(`Finished: ${results.length} item(s)`);
        for (const r of results) {
          if (r.error) this.log(`✗ ${r.chat}: ${r.error}`);
          else this.log(`✓ ${r.file} (${r.messages} msgs)`);
        }
        if (results.every((r) => !r.file)) {
          this.setProgress("导出失败：0 条消息");
        }
      } catch (err) {
        console.error(err);
        this.setProgress("Error: " + (err && err.message ? err.message : err));
        this.log("Export failed: " + err);
      } finally {
        STATE.busy = false;
        exportBtn.disabled = false;
        exportBtn.textContent = "导出所选";
        setTimeout(() => this.setProgress(""), 4000);
      }
    },

    runDiagnose() {
      this.log("—— 诊断 ——");
      try {
        const d = WAParser.diagnose();
        this.log(`URL: ${d.url}`);
        this.log(`#main: ${d.main} · header: ${d.header} · scroller: ${d.hasScroller}`);
        this.log(`当前标题: ${d.title || "(空)"}`);
        this.log(`命中消息节点: ${d.messageNodes}`);
        if (!d.main) {
          this.log("✗ 没有 #main —— 请先点开一个聊天，或刷新 WhatsApp Web");
        } else if (!d.messageNodes) {
          this.log("✗ 解析到 0 条 —— 可能未加载聊天 / 改版导致选择器失效");
          this.log("请把诊断结果里的 sample 发给我，或先刷新页面再试");
        } else {
          this.log(`✓ 可解析 ${d.messageNodes} 条`);
          for (const s of d.sample) {
            this.log(`  [${s.dir}] id=${s.id || "-"} ${s.testid || ""}`);
            this.log(`  text: ${s.textPreview || "(无文本/仅媒体)"}`);
          }
        }
        this.setProgress(`诊断: ${d.messageNodes} 条`);
      } catch (e) {
        this.log("诊断失败: " + e);
      }
    },

    /**
     * Collect media URLs visible in the open chat (images/videos) and trigger downloads
     * without full chat export. Useful quick path.
     */
    async quickExportMedia() {
      this.setProgress("Scanning current chat…");
      const byName = new Map();
      await WADOM.walkChatHistory({
        maxSteps: STATE.scrollRounds,
        stepPx: 700,
        delay: 400,
        onChunk: async (step) => {
          this.setProgress(`Media scan window ${step}… (${byName.size} files)`);
          const chunk = await WAParser.parseConversation({ includeMedia: true });
          await WAParser.resolveMediaBlobs(chunk, (d, t, fn) => {
            this.setProgress(`Media ${d}/${t} ${fn}`);
          });
          for (const m of chunk) {
            for (const media of m.media) {
              if (!media.blob) continue;
              if (media.kind === "video" && !STATE.includeVideo) continue;
              if (!byName.has(media.filename)) byName.set(media.filename, media);
            }
          }
        },
      });

      const title = WADOM.getActiveChatTitle() || "chat";
      const zip = new WAZip.ZipWriter();
      let n = 0;
      for (const media of byName.values()) {
        n += 1;
        await zip.add(`${WAExporter.safeFilename(title)}/media/${media.filename}`, media.blob);
      }
      const blob = zip.build();
      WAExporter.downloadBlob(blob, `${WAExporter.safeFilename(title)}_media.zip`);
      this.setProgress(`Downloaded ${n} media files`);
      this.log(`Quick media ZIP: ${n} files`);
      return n;
    },
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  global.WAUI = WAUI;
})(typeof self !== "undefined" ? self : globalThis);
