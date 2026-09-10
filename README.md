# WhatsApp Web Chat Backup — Export Chats to Markdown, HTML & ZIP

[English](README.md) | [简体中文](README.zh-CN.md)

**Free Chrome extension** to backup WhatsApp Web conversations: export **Markdown**, **HTML** (WhatsApp-style bubbles), and **ZIP** packs with **images, videos, and documents** — 100% local, no server upload.

> SEO keywords: WhatsApp Web backup, export WhatsApp chat, WhatsApp to Markdown, WhatsApp HTML export, download WhatsApp media, WhatsApp chat exporter Chrome extension, 聊天备份, 导出聊天记录

[![Version](https://img.shields.io/badge/version-1.4.9-green)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-informational)](https://developer.chrome.com/docs/extensions/)

## Features

- 📥 **One-click export** of selected chats from WhatsApp Web
- 📝 **Markdown (`.md`)** transcript with metadata table
- 🌐 **HTML** viewer — WhatsApp-like bubbles, doodle wallpaper, profile avatar
- 📦 **ZIP** bundle: `chat.md` + `chat.html` + `media/` (images, video, audio)
- 🖼️ Downloads **images & videos** via WPPConnect Store API (not fragile DOM scraping)
- 🏷️ Smart filenames: `Contact Name - PhoneNumber_YYYY-MM-DD`
- 🔒 **Fully offline** — data never leaves your browser
- 🌍 Multilingual docs: English · 简体中文

## Install (Developer Mode)

1. Download or clone this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select the project folder (contains `manifest.json`)
5. Log in to [WhatsApp Web](https://web.whatsapp.com)
6. **Refresh the page (F5)**
7. Open a chat → click the **green clock** in the header, or the floating button

### Quick ZIP

Grab the share pack from **Releases**, or build:

```bash
# From repo root (exclude .git)
```

## How to export

1. Open the side panel from the green button
2. Select chats (or **Export current chat**)
3. Default format: **ZIP** (includes Markdown + HTML + media)
4. Optional: standalone HTML / Markdown / TXT / JSON
5. Download files named like `ByDuoc - 84965265135_2026-09-11_backup.zip`

### ZIP structure

```
Contact - PhoneNumber/
├── chat.md
├── chat.html
└── media/
    ├── img_001.jpg
    └── video_001.mp4
```

## Architecture (why not “just scrape the DOM”)

WhatsApp Web is a virtualized SPA. Class names change often — DOM selectors easily export **0 messages**. This extension injects **[WPPConnect / wa-js](https://github.com/wppconnect-team/wa-js)** into the page and reads:

| API | Purpose |
|-----|---------|
| `WPP.chat.list` | Chat list |
| `WPP.chat.getMessages` | Full message history |
| `WPP.chat.downloadMedia` | Image / video / audio blobs |
| `WPP.contact.*` | Display name & phone number |

A `CustomEvent` bridge connects the content script to the page world (`requestId` correlated).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Empty list / 0 messages | Log in, **F5**, then Refresh in panel |
| Service Worker “invalid” | Reload extension, refresh WhatsApp |
| Missing video | Play the video once in chat, export again |
| Left nav missing | Use v1.4.5+; disable other WhatsApp mods to test |

## Privacy

- Runs entirely in **your browser**
- No analytics, no account, no cloud sync
- Only export chats you are allowed to keep

## Roadmap

- [ ] PDF export
- [ ] Search inside export panel
- [ ] i18n for the extension UI (EN / 中文)

## Tech stack

- Chrome Manifest V3
- WPPConnect / wa-js
- Custom ZIP writer (no heavy deps)
- Content script + lazy page injection

## Development

```bash
git clone <this-repo>
cd wa-chats-backup-pro
# Load unpacked in chrome://extensions
node scripts/test_wpp_export.js
```

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

Not affiliated with WhatsApp LLC or Meta Platforms, Inc. Use at your own risk and comply with local laws and WhatsApp Terms of Service.

---

**Related searches:** export WhatsApp chat to PDF/HTML, backup WhatsApp Web messages, download all WhatsApp photos from web, WhatsApp chat archive tool, Chrome extension WhatsApp exporter
