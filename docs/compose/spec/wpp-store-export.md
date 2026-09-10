---
feature: wpp-store-export
status: in-progress
updated: 2026-09-10
branch: feat/wpp-store-export
commits: 
---

# WPP Store Export

## Report

## [S1] Problem
DOM scraping of WhatsApp Web returned 0 messages: virtualized list, hashed class names, and `message-in/out` selectors no longer match. Reference extension *Chats Backup for wa* (CRX unpacked) injects WPPConnect and calls internal Store APIs 鈥?that is why it works.

## [S2] Design

### Architecture (same as reference)
```
content script (isolated world)
  鈹? inject <script src=libs/wppconnect-wa.js>
  鈹? inject <script src=injected.js>
  鈻?page world
  window.WPP.chat.list / getMessages / downloadMedia / getActiveChat
  window.WPP.contact.getProfilePictureUrl
  CustomEvent WABK_wpp 鈫?WABK_wpp_{eventName}_result
```

### Bridge contract
Request: `window.dispatchEvent(new CustomEvent('WABK_wpp', {detail:{eventName, params}}))`  
Response: listen once on `WABK_wpp_${eventName}_result`.

Events:
| eventName | params | result |
|---|---|---|
| isMainReady | 鈥?| boolean |
| keepAlive | 鈥?| true |
| getChatList | 鈥?| `[{id, name}]` |
| getActiveChat | 鈥?| `{id, name}` \| null |
| getMessages | `{chats:[{id,name}], count}` | `[{chatId, chatName, items:[Msg]}]` |
| downloadMedia | `{id}` | media object (data URL / blob payload) \| null |
| getProfilePicture | `{chatId}` | url string |

### Normalized message (injected mapper)
```
{
  id, time (ms), type, fromMe,
  displayName, formattedName, phone,
  reactions: [{text, senders:[]}],
  isMedia, isImage, isAudio, isVideo, isDocument,
  message,   // text body for type==='chat'
  caption,   // media caption
  filename, size
}
```

### Export
- Primary: Markdown `.md` (header table + `**璋?路 鏃堕棿**` + body + media markers)
- ZIP: `chat.md` + `media/*` (blobs from `downloadMedia`)
- Optional TXT/JSON
- If WPP not ready after timeout 鈫?clear error, do not download empty file

### UI
Keep green toolbar button + side panel. Chat list from `getChatList`. Diagnose shows `isMainReady`, list count, message count.

## [S3] Out of Scope
- Pro/paywall, OAuth login, server upload
- Cloning reference HTML bubble UI exactly (MD is the product format)
- Multi-account / non-web WhatsApp

## Tasks
- [ ] T1: Vendor `libs/wppconnect-wa.js` + write `injected.js` WPP bridge 鈥?acceptance: bridge events respond when WPP ready (covers: S2)
- [ ] T2: Rewrite content UI/exporter to use bridge 鈥?acceptance: chat list and messages come from WPP, not DOM walk (covers: S2)
- [ ] T3: Manifest web_accessible_resources + inject order 鈥?acceptance: extension loads without CSP errors (covers: S2)
- [ ] T4: Offline unit tests for MD builder + bridge mock 鈥?acceptance: node tests pass (covers: S2)
- [ ] T5: Syntax check + package zip 1.3.0 鈥?acceptance: all JS `node --check` pass (covers: S2)

