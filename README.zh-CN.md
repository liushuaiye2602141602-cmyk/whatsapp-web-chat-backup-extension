# WhatsApp Web 聊天备份 — 导出 Markdown / HTML / ZIP

[English](README.md) | [简体中文](README.zh-CN.md)

**免费 Chrome 扩展**：备份 WhatsApp Web 会话，导出 **Markdown**、**HTML**（WhatsApp 气泡样式）以及含**图片、视频、文档**的 **ZIP**。全部在本地浏览器完成，不上传服务器。

> 关键词：WhatsApp 聊天备份、导出聊天记录、WhatsApp 导出 Markdown、WhatsApp 导出 HTML、下载 WhatsApp 图片视频、Chrome 扩展聊天导出

[![版本](https://img.shields.io/badge/version-1.4.9-green)](manifest.json)
[![协议](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## 功能

- 📥 多选会话 **一键导出**
- 📝 **Markdown** 全文（含元信息表）
- 🌐 **HTML** 聊天视图：气泡、底纹、对方头像
- 📦 **ZIP**：`chat.md` + `chat.html` + `media/`
- 🖼️ 通过 WPPConnect 读取并打包**图片、视频**
- 🏷️ 文件名：`对方名字 - WhatsApp号码_日期`
- 🔒 **纯本地**，不经过任何服务器
- 🌍 文档：English · 简体中文

## 安装（开发者模式）

> ⚠️ **不要把 `.zip` 拖进 Chrome。**  
> Chrome **无法**加载 ZIP 扩展包。必须 **先解压**，再对**含 `manifest.json` 的文件夹**使用「加载已解压的扩展程序」。

1. 对 ZIP **右键 → 解压**
2. 打开解压后的文件夹，确认里面直接有 **`manifest.json`**  
   - 错误：拖入 `.zip`，或选了 `Downloads` 等上级目录  
   - 正确：选中解压出来的 `WA-Chats-Backup-Pro-v1.4.9` 文件夹
3. 打开 `chrome://extensions`
4. 打开 **开发者模式**
5. 点 **加载已解压的扩展程序** → 选择该文件夹（**不要拖 ZIP**）
6. 登录 [WhatsApp Web](https://web.whatsapp.com)
7. **F5 刷新页面**
8. 打开聊天 → 点标题栏 **绿色时钟**，或右侧悬浮按钮

仍提示「清单文件缺失或不可读取」= **选错了文件夹**。所选目录下必须直接有 `manifest.json`。
## 导出方法

1. 绿色按钮打开侧栏
2. 勾选聊天（或「导出当前聊天」）
3. 默认 **ZIP**（含 Markdown + HTML + 媒体）
4. 可选单独 HTML / Markdown / TXT / JSON
5. 下载文件名类似 `ByDuoc - 84965265135_2026-09-11_backup.zip`

### ZIP 结构

```
对方名字 - 号码/
├── chat.md
├── chat.html
└── media/
    ├── img_001.jpg
    └── video_001.mp4
```

## 技术原理（为什么不扫 DOM）

WhatsApp Web 是虚拟列表 SPA，类名经常变更，纯 DOM 选择器容易导出 **0 条**。本扩展向页面注入 **[WPPConnect / wa-js](https://github.com/wppconnect-team/wa-js)**，调用：

| API | 用途 |
|-----|------|
| `WPP.chat.list` | 会话列表 |
| `WPP.chat.getMessages` | 完整消息历史 |
| `WPP.chat.downloadMedia` | 图片 / 视频 / 语音 |
| `WPP.contact.*` | 显示名与手机号 |

内容脚本与页面之间用带 `requestId` 的 CustomEvent 桥接。

## 常见问题

| 问题 | 处理 |
|------|------|
| 列表空 / 0 条 | 登录后 **F5**，再点面板「刷新」 |
| Service Worker 无效 | 重新加载扩展并刷新 WhatsApp |
| 视频缺失 | 先在聊天里点一下播放再导出 |
| 左侧菜单消失 | 使用 v1.4.5+ |

## 隐私

- 仅在**你的浏览器**内运行
- 无统计、无账号、无云同步
- 请只导出你有权保存的会话

## 开发

```bash
git clone <本仓库>
cd wa-chats-backup-pro
node scripts/test_wpp_export.js
```

## 协议

MIT，见 [LICENSE](LICENSE)。

## 免责

本项目与 WhatsApp LLC / Meta Platforms, Inc. 无关。使用风险自负，并请遵守当地法律与 WhatsApp 服务条款。

---

**相关搜索：** WhatsApp 聊天记录导出、备份 WhatsApp 网页版、下载 WhatsApp 全部图片、WhatsApp 归档工具
