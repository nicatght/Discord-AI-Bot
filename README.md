# Discord-AI-Bot

住在 Discord 的 AI 小助手，可以幫你搜尋遊戲兌換碼、展示你的帳戶資訊，以及生成角色卡片。

## 功能

- 綁定 Discord 用戶與遊戲帳戶 UID（一對一）
- 查詢玩家公開展示櫃資訊
- 生成精美角色卡片圖片
- 使用 Google Gemini + Google Search 搜尋最新兌換碼
- 定時備份 UID 資料到 JSONBin.io（選填）

## 目前支援遊戲

| 遊戲           | 狀態                   |
| -------------- | ---------------------- |
| 崩壞：星穹鐵道 | 已支援                 |
| 絕區零         | 部分支援（兌換碼查詢） |
| 鳴潮           | 計畫中                 |

## 指令一覽

| 指令                 | 功能                   |
| -------------------- | ---------------------- |
| `/honkai-star-rail`  | 崩鐵相關功能           |
| - UID 管理           | 註冊 / 更換 / 刪除 UID |
| - 帳戶展示           | 顯示玩家基本資訊       |
| - 展示角色           | 生成角色卡片圖片       |
| - 兌換碼查詢         | 搜尋最新有效兌換碼     |
| `/zenless-zone-zero` | 絕區零相關功能         |
| - 兌換碼查詢         | 搜尋最新有效兌換碼     |
| `/ping`              | 檢查機器人連線狀態     |

## 快速開始

詳細的安裝步驟和 Token 獲取教學請參考 **[快速使用教學](./docs/快速使用.md)**。

### 環境需求

- Node.js 20+
- Python 3.10+（角色卡片生成）
- Docker（選填，推薦）

### 最快上手

```bash
# 1. 複製專案
git clone https://github.com/your-username/Discord-AI-Bot.git
cd Discord-AI-Bot

# 2. 設定環境變數
cp env.example .env
# 編輯 .env 填入你的 Token（獲取方式請參考快速使用教學）

# 3. 使用 Docker Compose 執行（推薦）
docker-compose up -d
```

## 更多說明

| 文件                               | 內容                           |
| ---------------------------------- | ------------------------------ |
| [快速使用教學](./docs/快速使用.md) | Token 獲取、安裝步驟、常見問題 |
| [專案總覽](./docs/專案總覽.md)     | 架構設計、目錄結構、開發指南   |
| [特別銘謝](./docs/特別銘謝.md)     | 使用的開源專案和服務           |
| [更新日誌](./docs/更新日誌.md)     | 詳細版本歷史                   |

## 資料來源

- 玩家資料：[MiHoMo API](https://api.mihomo.me/)（非官方）
- 角色卡片：[starrailcard](https://github.com/DEViantUA/StarRailCard)
- 兌換碼搜尋：Google Gemini + Google Search

## 授權

MIT License

## 開發人員

九貓
