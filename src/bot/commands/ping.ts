import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

// 定義指令
export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check if the bot is alive");

// 執行指令
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const latency = Date.now() - interaction.createdTimestamp;
  await interaction.reply(`Pong! Latency: ${latency}ms`);
}
