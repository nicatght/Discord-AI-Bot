import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { messageHandler } from './handlers/messageHandler';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`Bot is ready! Logged in as ${client.user?.tag}`);
});

client.on('messageCreate', async (message) => {
  // 忽略机器人的消息
  if (message.author.bot) return;

  await messageHandler(message);
});

client.login(process.env.DISCORD_TOKEN);

