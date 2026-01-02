import { Client, GatewayIntentBits } from 'discord.js';
import { messageHandler } from './handlers/messageHandler';
import { config } from '../config';

// 建立 Discord client
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
  console.error('[ERROR] Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('[WARN] Discord warning:', warning);
});

client.on('messageCreate', async (message) => {
  // 忽略機器人的訊息
  if (message.author.bot) return;

  await messageHandler(message);
});

// 啟動 Bot 連線
export async function startBot(): Promise<void> {
  try {
    await client.login(config.discord.token);
  } catch (error: any) {
    console.error('[ERROR] Login failed:', error.message);

    if (error.message.includes('disallowed intents') || error.message.includes('intents')) {
      console.error('\n[INFO] Intent not enabled:');
      console.error('   1. Go to https://discord.com/developers/applications');
      console.error('   2. Select your Bot application');
      console.error('   3. Select "Bot" from the left menu');
      console.error('   4. Scroll down to "Privileged Gateway Intents"');
      console.error('   5. Enable "MESSAGE CONTENT INTENT"');
      console.error('   6. Save changes');
      console.error('   7. Restart the program');
    } else if (error.code === 'TokenInvalid') {
      console.error('\n[INFO] Invalid token:');
      console.error('   1. Token expired or reset - check Discord Developer Portal');
      console.error('   2. Token format error - make sure no extra spaces or quotes');
      console.error('   3. Token leaked - if public, reset immediately');
    }

    process.exit(1);
  }
}

export { client };

