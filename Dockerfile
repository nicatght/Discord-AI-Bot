# ================================================
# Discord AI Bot - Docker Image
# ================================================
# 使用方式：
#   建立 image:  docker build -t discord-ai-bot .
#   執行容器:    docker run --env-file .env discord-ai-bot
#
# Zeabur 部署：環境變數在平台上設定，不需要 .env 檔案
# ================================================

# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# 複製 package files
COPY package*.json ./

# 安裝所有依賴（包含 devDependencies 用於編譯）
RUN npm ci

# 複製原始碼
COPY tsconfig.json ./
COPY src/ ./src/

# 編譯 TypeScript
RUN npm run build

# ================================================
# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

# 安裝系統依賴
# - python3: Python 執行環境
# - gcc, musl-dev, python3-dev: 編譯 Python C 擴展（如 Pillow）
# - fontconfig, ttf-dejavu: 字型支援
# - font-noto-cjk: 中日韓文字型（支援繁體中文）
RUN apk add --no-cache \
    python3 \
    gcc \
    musl-dev \
    python3-dev \
    fontconfig \
    ttf-dejavu \
    font-noto-cjk && \
    wget -qO- https://astral.sh/uv/install.sh | sh && \
    fc-cache -fv

# 將 uv 加入 PATH
ENV PATH="/root/.local/bin:$PATH"

# 複製 package files
COPY package*.json ./

# 只安裝生產依賴
RUN npm ci --only=production

# 從 builder 階段複製編譯後的程式碼
COPY --from=builder /app/dist ./dist

# 複製 Python 腳本（TypeScript 編譯不會複製 .py 檔案）
COPY src/games/hsr/generate_card.py ./dist/games/hsr/

# 複製 Python 相關檔案（pyproject.toml 和 uv.lock 在根目錄）
COPY pyproject.toml uv.lock ./

# 使用 uv sync 安裝 Python 依賴
RUN uv sync --no-dev

# 建立資料目錄
RUN mkdir -p src/db/data

# 設定環境變數（可被 docker run -e 覆蓋）
ENV NODE_ENV=production

# 啟動 Bot
CMD ["node", "dist/index.js"]
