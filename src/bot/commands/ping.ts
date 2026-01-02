/**
 * ping 指令: 查看連線狀態與延遲
 * 
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

// 定義指令
export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("查看: 連線狀態與延遲");

// 執行指令
export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const latency = Date.now() - interaction.createdTimestamp;
  await interaction.reply(`指令接收! 延遲: ${latency}ms`);
}
