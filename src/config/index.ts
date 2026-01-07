// 注意：dotenv 應該在入口檔案（bot/index.ts）中載入，這裡不再重複載入
// 使用函數動態讀取環境變數，確保在 dotenv.config() 之後讀取

function getConfig() {
  return {
    discord: {
      get token() {
        return process.env.DISCORD_TOKEN || '';
      },
      get guildId() {
        return process.env.DISCORD_GUILD_ID || '';
      },
    },
    gemini: {
      get apiKey() {
        return process.env.GEMINI_API_KEY || '';
      },
      // 免費版推薦：gemini-2.5-flash-lite（最快、最便宜、支援 Google Search）
      get model() {
        return process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
      },
    },
    bot: {
      get prefix() {
        return process.env.BOT_PREFIX || '!';
      },
      get maxContextMessages() {
        return parseInt(process.env.MAX_CONTEXT_MESSAGES || '30', 10);
      },
    },
    jsonBin: {
      // JSONBin.io 設定（選填，若未設定則只使用本地儲存）
      get apiKey() {
        return process.env.JSONBIN_API_KEY || '';
      },
      get binId() {
        return process.env.JSONBIN_BIN_ID || '';
      },
      // 檢查是否已設定 JSONBin
      get isEnabled() {
        return !!(process.env.JSONBIN_API_KEY && process.env.JSONBIN_BIN_ID);
      },
    },
  };
}

// 匯出設定物件，使用 getter 確保每次存取都讀取最新的環境變數
export const config = getConfig();

// 驗證必要的設定（在執行時檢查，而不是模組載入時）
export function validateConfig(): void {
  if (!config.discord.token || config.discord.token.trim() === '') {
    throw new Error('DISCORD_TOKEN 未設置或為空，請檢查 .env 檔案中的 DISCORD_TOKEN 是否正確設置');
  }

  // Gemini API Key 暫時不強制（可以先測試 DC 連接）
  // if (!config.gemini.apiKey || config.gemini.apiKey.trim() === '') {
  //   throw new Error('GEMINI_API_KEY 未設置，請檢查 .env 檔案');
  // }
}

