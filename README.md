# WA Chats Backup Pro

Chrome 扩展：在 WhatsApp Web 上通过 **WPPConnect Store** 导出聊天为 Markdown，并打包图片/视频。  
架构对齐 *Chats Backup for wa*（已反编译研究其 CRX）。

## 为什么不用 DOM 扫描？
WhatsApp Web 虚拟列表 + 动态类名导致 DOM 选择器经常解析到 0 条。  
参考扩展注入 `wppconnect-wa.js`，调用页面内 `WPP.chat.list / getMessages / downloadMedia`。

## 安装
1. `chrome://extensions` → 开发者模式
2. 加载已解压 → `D:\ai\Mimo\wa-chats-backup-pro`
3. 打开 [WhatsApp Web](https://web.whatsapp.com) 并 **F5 刷新**
4. 点聊天栏绿色按钮 → **诊断 WPP** → 应显示 `isMainReady: true`
5. 勾选聊天 → 导出 MD / ZIP

## 导出
- **Markdown**：标题表 + `**发送者 · 时间**` + 正文 + 媒体标记
- **ZIP**：`chat.md` + `media/`（`downloadMedia` 拉到的文件）

## 架构
```
content script ──inject──► page world
  wpp.js                 libs/wppconnect-wa.js  (window.WPP)
  exporter.js            injected.js (CustomEvent bridge)
  ui.js
Bridge: WABK_wpp → WABK_wpp_{event}_result
Events: isMainReady, keepAlive, getChatList, getMessages, downloadMedia, getActiveChat, getProfilePicture
```

## 版本
- **1.3.0** — WPP Store 注入（修复 0 条导出）
- 1.2.0 — 多策略 DOM 解析（已弃用为主路径）

## 目录
```
wa-chats-backup-pro/
├── manifest.json
├── injected.js          # 页面内 WPP 桥
├── libs/wppconnect-wa.js
├── content/
│   ├── wpp.js           # content → page 调用
│   ├── exporter.js      # MD/ZIP
│   ├── ui.js
│   ├── main.js
│   └── styles.css
└── popup/
```
