/**
 * 絕區零相關指令
 *
 * TODO: 未來實作 ZZZ 相關功能
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { searchRedemptionCodes, isGeminiEnabled } from "../../ai/gemini";

// 定義指令
export const data = new SlashCommandBuilder()
  .setName("zenless-zone-zero")
  .setDescription("絕區零 相關指令")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("選擇功能")
      .setRequired(true)
      .addChoices({ name: "兌換碼查詢", value: "codes" })
  );

// 執行指令
export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const action = interaction.options.getString("action", true);

  switch (action) {
    case "codes":
      await handleCodes(interaction);
      break;

    default:
      await interaction.reply({
        content: "未知的操作",
        flags: MessageFlags.Ephemeral,
      });
  }
}

// 處理兌換碼查詢
async function handleCodes(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!isGeminiEnabled()) {
    await interaction.reply({
      content:
        "Gemini API 尚未設定，無法查詢兌換碼。請在 .env 設定 GEMINI_API_KEY",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const result = await searchRedemptionCodes("zzz");

    const embed = new EmbedBuilder()
      .setTitle("絕區零最新兌換碼")
      .setDescription(result)
      .setColor(0xffa500)
      .setTimestamp()
      .setFooter({
        text: "Powered by Gemini + Google Search | AI 可能會出錯",
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("[ZZZ] Codes search error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await interaction.editReply({
      content: `查詢兌換碼失敗: ${errorMessage}`,
    });
  }
}
