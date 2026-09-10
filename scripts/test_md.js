/**
 * Offline test for Markdown export.
 * Run: node scripts/test_md.js
 */
const path = require("path");
const fs = require("fs");

// Minimal globals
global.self = global;
global.WADOM = {
  clickChat: async () => {},
  sleep: async () => {},
  walkChatHistory: async () => {},
};
global.WAParser = {
  parseConversation: async () => [],
  resolveMediaBlobs: async (m) => m,
};
global.WAZip = {
  ZipWriter: class {
    constructor() {
      this.entries = [];
    }
    async add(name, data) {
      this.entries.push({ name, data });
      return this;
    }
    build() {
      return new Blob([`zip:${this.entries.map((e) => e.name).join(",")}`]);
    }
  },
};

// load exporter
const src = fs.readFileSync(path.join(__dirname, "../content/exporter.js"), "utf8");
eval(src);

const chat = { title: "ByDuoc", chatId: "227938561720516@lid" };
const messages = [
  {
    id: "1",
    direction: "out",
    sender: "me",
    time: "[22:27:24, 7/25/2026]",
    text: "hello",
    media: [],
    reactions: "",
  },
  {
    id: "2",
    direction: "incoming",
    sender: "ByDuoc",
    time: "[08:49:29, 7/26/2026]",
    text: "Hello,\n\nThank you for your question.",
    media: [
      { kind: "image", filename: "img_001.jpg", blob: null },
      { kind: "video", filename: "video_001.mp4", blob: null },
    ],
    reactions: "👍",
  },
];

const mdNames = WAExporter.toMarkdown(chat, messages, { mediaMode: "names" });
const mdRel = WAExporter.toMarkdown(chat, messages, { mediaMode: "relative" });

console.log("--- names mode ---");
console.log(mdNames);
console.log("--- relative mode ---");
console.log(mdRel);

const checks = [
  [mdNames.includes("# ByDuoc"), "title"],
  [mdNames.includes("227938561720516@lid"), "chat id"],
  [mdNames.includes("**我 · 2026/7/25 22:27:24**"), "outgoing stamp"],
  [mdNames.includes("**ByDuoc · 2026/7/26 08:49:29**"), "incoming stamp"],
  [mdNames.includes("hello"), "text"],
  [mdNames.includes("📷 图片: `img_001.jpg`"), "image name"],
  [mdNames.includes("📹 视频: `video_001.mp4`"), "video name"],
  [mdRel.includes("![img_001.jpg](media/img_001.jpg)"), "relative image"],
  [mdRel.includes("[video_001.mp4](media/video_001.mp4)"), "relative video"],
  [mdNames.includes("| 消息数 | 2 |"), "meta table"],
];

let fail = 0;
for (const [ok, name] of checks) {
  if (!ok) {
    console.error("FAIL", name);
    fail++;
  } else {
    console.log("OK", name);
  }
}

if (fail) process.exit(1);
console.log("All MD checks passed");
