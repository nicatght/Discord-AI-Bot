import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { messageHandler } from './handlers/messageHandler';
import { config, validateConfig } from '../config';

// 加载环境变量
dotenv.config();

// 验证配置
validateConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(`Bot is ready! Logged in as ${client.user?.tag}`);
});

client.on('error', (error) => {
  console.error('❌ Discord 客户端错误:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️  Discord 警告:', warning);
});

client.on('messageCreate', async (message) => {
  // 忽略机器人的消息
  if (message.author.bot) return;

  await messageHandler(message);
});

// 登录并处理错误
client.login(config.discord.token).catch((error) => {
  console.error('❌ 登录失败:', error.message);
  
  if (error.message.includes('disallowed intents') || error.message.includes('intents')) {
    console.error('\n💡 Intent 未启用错误:');
    console.error('   需要在 Discord Developer Portal 中启用以下 Intent:');
    console.error('   1. 前往 https://discord.com/developers/applications');
    console.error('   2. 选择你的 Bot 应用');
    console.error('   3. 左侧菜单选择 "Bot"');
    console.error('   4. 向下滚动到 "Privileged Gateway Intents"');
    console.error('   5. ✅ 启用 "MESSAGE CONTENT INTENT" (必须！)');
    console.error('   6. 保存更改');
    console.error('   7. 重新运行程序');
  } else if (error.code === 'TokenInvalid') {
    console.error('\n💡 Token 无效:');
    console.error('   1. Token 已过期或被重置 - 请到 Discord Developer Portal 检查');
    console.error('   2. Token 格式错误 - 确保没有多余的空格或引号');
    console.error('   3. Token 已泄露 - 如果 Token 已公开，请立即重置');
  }
  
  process.exit(1);
});

