---
feature: wpp-store-export
status: delivered
updated: 2026-09-10
branch: feat/wpp-store-export
commits: fa37f1e..HEAD
---

# WPP Store Export

## Report

**What was built** — WhatsApp Web backup extension that injects WPPConnect (`libs/wppconnect-wa.js`) into the page world and reads chats via Store APIs (`chat.list` / `getMessages` / `downloadMedia`). Content script talks to the page through a correlated CustomEvent bridge (`WABK_wpp` + `requestId` → `WABK_wpp_result`). Default export is a single ZIP containing `chat.md`, WhatsApp-style `chat.html`, and media blobs. Optional standalone HTML (embedded media), MD, TXT, JSON. Messages and chat list are deduplicated by id. Green toolbar button opens multi-select panel with diagnose.

**Verification** — `node --check` on injected.js, content/wpp.js, content/exporter.js, content/ui.js, content/main.js: PASS. `node scripts/test_wpp_export.js`: PASS (MD, HTML bubbles, dedupe, mediaResultToBlob, exportChats). Package `WA-Chats-Backup-Pro-1.4.0.zip`.

**Journey log**
1. DOM selectors returned 0 messages — switched to WPPConnect Store injection (same as reference CRX).
2. Review criticals: per-chat fetch, no reaction N+1, requestId correlation — fixed in 1.3.0.
3. User: duplicate-looking files (standalone .md + ZIP with same chat.md) and no HTML — 1.4.0 defaults to ZIP-only; ZIP includes md+html; standalone HTML optional; message/list dedupe.

## [S1] Problem
DOM scraping of WhatsApp Web returned 0 messages: virtualized list, hashed class names, and `message-in/out` selectors no longer match. Reference extension *Chats Backup for wa* injects WPPConnect and calls internal Store APIs.

## [S2] Design

### Architecture
```
content script (isolated world)
  inject libs/wppconnect-wa.js  → window.WPP
  inject injected.js            → CustomEvent bridge
page world
  WPP.chat.list / getMessages / downloadMedia / getActiveChat
```

### Bridge contract
Request: `CustomEvent('WABK_wpp', {detail:{eventName, params, requestId}})`  
Response: `CustomEvent('WABK_wpp_result', {detail:{requestId, eventName, ok, data, error}})`

| eventName | params | notes |
|---|---|---|
| isMainReady | — | boolean |
| keepAlive | — | true |
| getChatList | — | `[{id, name}]` |
| getActiveChat | — | `{id, name}` \| null |
| getMessages | `{chats:[one chat], count}` | one chat per call; timeout 120s |
| downloadMedia | `{id}` | Blob or null |

### Export
- Default single ZIP: `ChatName/chat.md` + `ChatName/chat.html` + `ChatName/media/*`
- Optional standalone: `html` (embed data URLs), `md`, `txt`, `json`
- `dedupeMessages` by id; chat list deduped by id
- Same `exportFilename` in MD/HTML and ZIP media entries
- WPP not ready → error, no empty download

## [S3] Out of Scope
- Pro/paywall, OAuth, server upload
- Multi-account / non-web WhatsApp

## Tasks
- [x] T1: Vendor `libs/wppconnect-wa.js` + `injected.js` WPP bridge (covers: S2)
- [x] T2: Rewrite content UI/exporter to use bridge (covers: S2)
- [x] T3: Manifest web_accessible_resources + inject order (covers: S2)
- [x] T4: Offline unit tests for MD builder + bridge mock (covers: S2)
- [x] T5: Syntax check + package zip (covers: S2)
- [x] T6: Review criticals (per-chat fetch, no reaction N+1, requestId) (covers: S2)
- [x] T7: Dedupe + HTML export + ZIP-only default (covers: S2)
