# WA Chats Backup Pro

Chrome 扩展：在 WhatsApp Web 上导出聊天记录为 **Markdown**，并可打包图片、视频。  
类似 *Chats Backup for wa*：聊天标题栏绿色时钟按钮 + 侧边面板多选导出。

## 功能

- 聊天列表多选 / 全选 / 仅当前会话 / 清空 / 刷新
- **默认导出 Markdown (.md)**，结构：
  - 标题 + 元信息表（聊天名、Chat ID、导出时间、消息数、媒体数）
  - 每条消息：`**发送者 · 时间**` + 正文
  - 媒体以 `📷 / 📹 / 📎` 标注；ZIP 内用相对路径 `media/xxx.jpg`（图片为 `![]()` 可预览）
- ZIP：`chat.md` + `media/`（图片、视频、文档）
- 可选 TXT / JSON
- 自动滚动加载历史；边滚动边抓取媒体 blob

## 安装

1. Chrome → `chrome://extensions`
2. 开启 **开发者模式**
3. **加载已解压的扩展程序** → 选择 `D:\ai\Mimo\wa-chats-backup-pro`
4. 登录 [WhatsApp Web](https://web.whatsapp.com) 并 **刷新页面**
5. 点聊天标题栏绿色时钟按钮，或扩展图标

## 使用

1. 等左侧聊天列表加载
2. 点绿色按钮打开面板
3. 勾选聊天（默认勾选 **Markdown + ZIP**）
4. 点 **导出所选**
5. 浏览器会下载 `.md` 与 `_backup.zip`

### 导出示例（Markdown）

```markdown
# ByDuoc

| 项目 | 内容 |
| --- | --- |
| 聊天 | ByDuoc |
| Chat ID | 227938561720516@lid |
| 导出时间 | 2026/9/10 21:42:08 |
| 消息数 | 156 |
| 媒体数 | 12 |

---

**我 · 2026/7/25 22:27:24**

hello

---

**ByDuoc · 2026/7/26 08:49:29**

Hello,

Thank you for your question.

---

**ByDuoc · 2026/7/26 09:01:00**

📷 图片: `img_001.jpg`
📹 视频: `video_001.mp4`
```

ZIP 内同一条会变成：

```markdown
![img_001.jpg](media/img_001.jpg)

📹 [video_001.mp4](media/video_001.mp4)
```

### ZIP 结构

```
ByDuoc_2026-09-10_backup.zip
└── ByDuoc/
    ├── chat.md
    └── media/
        ├── img_001.jpg
        └── video_001.mp4
```

## 目录

```
wa-chats-backup-pro/
├── manifest.json
├── background.js
├── icons/
├── lib/zip.js
├── content/
│   ├── dom.js
│   ├── parser.js
│   ├── exporter.js
│   ├── ui.js
│   ├── main.js
│   └── styles.css
└── popup/
```

## 版本

- 1.1.0 — 主导出改为 Markdown；ZIP 内 `chat.md` + `media/`
- 1.0.0 — 初版

## 注意

- 仅支持 `https://web.whatsapp.com`
- 改版导致选择器失效时，更新 `content/dom.js`
- 仅导出你有权备份的会话
