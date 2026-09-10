---
feature: wpp-store-export
status: delivered
updated: 2026-09-10
branch: feat/wpp-store-export
commits: fa37f1e..HEAD
---

# WPP Store Export

## Report

**What was built** — WhatsApp Web backup extension that injects WPPConnect (`libs/wppconnect-wa.js`) into the page world and reads chats via Store APIs (`chat.list` / `getMessages` / `downloadMedia`), instead of fragile DOM scraping. Content script talks to the page through a correlated CustomEvent bridge (`WABK_wpp` + `requestId` → `WABK_wpp_result`). Export is Markdown (primary) plus ZIP containing `chat.md` + media blobs. Green toolbar button opens a side panel with multi-select, diagnose, and export.

**Verification** — `node --check` on injected.js, content/wpp.js, content/exporter.js, content/ui.js, content/main.js, background.js, popup.js: PASS. `JSON.parse(manifest.json)`: PASS. `node scripts/test_wpp_export.js`: PASS (MD builder, mediaResultToBlob, exportChats mock with getMessagesForChat). Package `WA-Chats-Backup-Pro-1.3.0.zip`.

**Journey log**
1. DOM selectors (`message-in/out`, `[data-id]`) returned 0 messages on live WhatsApp Web — virtualization + class renames.
2. Unpacked reference CRX *Chats Backup for wa* — same `wppconnect-wa.js` (wa-js v4.5.0), CustomEvent bridge, `count:-1` full history.
3. Review of first WPP rewrite flagged C1 (single multi-chat full-history call under 20s timeout), C2 (per-message `getReactions` N+1), C3 (no requestId). Fixed: per-chat `getMessagesForChat` with 120s timeout, no reaction fan-out, correlated results.
4. Always call one chat per bridge request for full history; never batch N chats × Infinity in one CustomEvent.

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
  WPP.contact.getProfilePictureUrl
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
| getMessages | `{chats:[one chat], count}` | call **one chat at a time**; timeout 120s |
| downloadMedia | `{id}` | Blob (structured-clone) or null |
| getProfilePicture | `{chatId}` | url string |

### Normalized message
```
id (from id._serialized), time (ms), type, fromMe,
displayName, formattedName, phone,
reactions (inline only — no per-message API),
isMedia, isImage, isAudio, isVideo, isDocument,
message, caption, filename, size
```

### Export
- Markdown `.md` + ZIP `ChatName/chat.md` + `ChatName/media/*`
- Same `exportFilename` used in MD links and ZIP entries
- Per-chat try/catch; WPP not ready → error, no empty download

## [S3] Out of Scope
- Pro/paywall, OAuth, server upload
- Exact reference HTML bubble UI (MD is the product format)
- Multi-account / non-web WhatsApp

## Tasks
- [x] T1: Vendor `libs/wppconnect-wa.js` + `injected.js` WPP bridge — acceptance: bridge events respond when WPP ready (covers: S2)
- [x] T2: Rewrite content UI/exporter to use bridge — acceptance: list/messages from WPP, not DOM (covers: S2)
- [x] T3: Manifest web_accessible_resources + inject order — acceptance: loads without missing-resource errors (covers: S2)
- [x] T4: Offline unit tests for MD builder + bridge mock — acceptance: node tests pass (covers: S2)
- [x] T5: Syntax check + package zip 1.3.0 — acceptance: all JS `node --check` pass (covers: S2)
- [x] T6: Review criticals (per-chat fetch, no reaction N+1, requestId, stable media names) — acceptance: fixes committed and tests pass (covers: S2)
