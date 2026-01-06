// 注意：dotenv 应该在入口文件（bot/index.ts）中加载，这里不再重复加载
// 使用函数动态读取环境变量，确保在 dotenv.config() 之后读取

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
      // 2025 最新免費版本：優先使用 Gemini 3 Flash，如果不可用則回退到 1.5 Flash
      get model() {
        return process.env.GEMINI_MODEL || 'gemini-3-flash-latest';
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

// 导出配置对象，使用 getter 确保每次访问都读取最新的环境变量
export const config = getConfig();

// 驗證必要的配置（在運行時檢查，而不是模塊加載時）
export function validateConfig(): void {
  if (!config.discord.token || config.discord.token.trim() === '') {
    throw new Error('DISCORD_TOKEN 未設置或為空，請檢查 .env 文件中的 DISCORD_TOKEN 是否正確設置');
  }

  // Gemini API Key 暂时不强制（可以先测试 DC 连接）
  // if (!config.gemini.apiKey || config.gemini.apiKey.trim() === '') {
  //   throw new Error('GEMINI_API_KEY 未設置，請檢查 .env 文件');
  // }
}

