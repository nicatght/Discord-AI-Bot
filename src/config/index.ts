import dotenv from 'dotenv';

dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-1.5-flash', // Gemini Flash 版本
  },
  bot: {
    prefix: process.env.BOT_PREFIX || '!',
    maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES || '30', 10),
  },
};

// 验证必要的配置
if (!config.discord.token) {
  throw new Error('DISCORD_TOKEN 未设置');
}

if (!config.gemini.apiKey) {
  throw new Error('GEMINI_API_KEY 未设置');
}

