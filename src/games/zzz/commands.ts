/**
 * Zenless Zone Zero (ZZZ) Commands
 *
 * 提供絕區零相關功能：
 * - UID 管理（註冊、更換、刪除）
 * - 帳戶展示（顯示玩家基本資訊和展示櫃角色）
 * - 兌換碼查詢
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  MessageFlags,
} from "discord.js";
import { fetchPlayerShowcase, getElementColor, ZzzShowcase } from "./service";
import { getZzzUid, setZzzUid, deleteZzzUid, getAllZzzUids } from "../../db";
import { searchRedemptionCodes, isGeminiEnabled } from "../../ai/gemini";

// Autocomplete 選項
const ACTION_CHOICES = [
  { name: "UID 管理", value: "uid" },
  { name: "帳戶展示", value: "profile" },
  { name: "兌換碼查詢", value: "codes" },
];

// Custom IDs
const MENU_UID = "zzz_menu_uid";
const MENU_SHOWCASE_CHAR = "zzz_menu_showcase_char";
const MODAL_UID_ADD = "zzz_modal_uid_add";
const MODAL_UID_INPUT = "zzz_modal_uid_input";
const BTN_UID_DELETE_CONFIRM = "zzz_btn_uid_delete_confirm";
const BTN_UID_DELETE_CANCEL = "zzz_btn_uid_delete_cancel";

// 暫存玩家資料（用於 showcase 選角後顯示）
const playerDataCache = new Map<
  string,
  { data: ZzzShowcase; timestamp: number }
>();
const CACHE_TTL = 60000; // 1 分鐘

// 定義指令
export const data = new SlashCommandBuilder()
  .setName("zenless-zone-zero")
  .setDescription("絕區零 相關指令")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("選擇功能")
      .setRequired(true)
      .setAutocomplete(true)
  );

// 處理 Autocomplete
export async function autocomplete(
  interaction: AutocompleteInteraction
): Promise<void> {
  const focusedValue = interaction.options.getFocused().toLowerCase();

  const filtered = ACTION_CHOICES.filter((choice) =>
    choice.name.toLowerCase().includes(focusedValue)
  );

  await interaction.respond(filtered.slice(0, 25));
}

// UID 子選單（根據用戶是否已註冊顯示不同選項）
function createUidMenu(hasRegistered: boolean) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(MENU_UID)
    .setPlaceholder("選擇 UID 操作");

  if (hasRegistered) {
    select.addOptions([
      { label: "更換 UID", value: "add", description: "更換新的 UID" },
      { label: "刪除 UID", value: "delete", description: "解除綁定" },
      { label: "查看統計", value: "stats", description: "查看 UID 註冊統計" },
    ]);
  } else {
    select.addOptions([
      { label: "註冊 UID", value: "add", description: "綁定你的絕區零 UID" },
      { label: "查看統計", value: "stats", description: "查看 UID 註冊統計" },
    ]);
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

// 刪除 UID 按鈕介面
function createDeleteConfirmButtons() {
  const confirm = new ButtonBuilder()
    .setCustomId(BTN_UID_DELETE_CONFIRM)
    .setLabel("確認刪除")
    .setStyle(ButtonStyle.Danger);

  const cancel = new ButtonBuilder()
    .setCustomId(BTN_UID_DELETE_CANCEL)
    .setLabel("取消")
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);
}

// 執行指令
export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const action = interaction.options.getString("action", true);
  const userId = interaction.user.id;

  switch (action) {
    case "uid": {
      const existingUid = getZzzUid(userId);
      const hasRegistered = !!existingUid;
      const statusMsg = hasRegistered
        ? `你已註冊 UID: \`${existingUid}\``
        : "你尚未註冊 UID";

      await interaction.reply({
        content: `${statusMsg}\n請選擇操作：`,
        components: [createUidMenu(hasRegistered)],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }

    case "profile":
      await handleProfile(interaction, userId);
      break;

    case "codes":
      await handleCodes(interaction);
      break;

    default:
      await interaction.reply({
        content: "未知的操作，請從選單中選擇",
        flags: MessageFlags.Ephemeral,
      });
  }
}

// 處理 Select Menu 互動
export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const value = interaction.values[0];

  if (interaction.customId === MENU_UID) {
    switch (value) {
      case "add":
        await showUidModal(interaction);
        break;

      case "delete":
        await handleDeleteConfirm(interaction, userId);
        break;

      case "stats":
        await handleStats(interaction);
        break;
    }
  } else if (interaction.customId === MENU_SHOWCASE_CHAR) {
    await handleShowcaseCharacterSelect(interaction, userId, value);
  }
}

// 顯示 UID 輸入 Modal
async function showUidModal(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_UID_ADD)
    .setTitle("註冊絕區零 UID");

  const uidInput = new TextInputBuilder()
    .setCustomId(MODAL_UID_INPUT)
    .setLabel("請輸入你的 UID（10 位數字）")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("例如: 1300012345")
    .setMinLength(10)
    .setMaxLength(10)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(uidInput);
  modal.setComponents(row);

  await interaction.showModal(modal);
}

// 處理 Modal 提交
export async function handleModalSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  if (interaction.customId !== MODAL_UID_ADD) return;

  const userId = interaction.user.id;
  const uid = interaction.fields.getTextInputValue(MODAL_UID_INPUT);

  // 驗證 UID 格式
  if (!/^\d{10}$/.test(uid)) {
    await interaction.reply({
      content: "UID 格式錯誤！請輸入 10 位數字",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await setZzzUid(userId, uid);

  if (result.success) {
    await interaction.editReply(
      `已註冊 UID: \`${uid}\`\n玩家名稱: **${result.nickname}**`
    );
  } else {
    await interaction.editReply(`註冊失敗: ${result.error}`);
  }
}

// 處理 Button 互動
export async function handleButton(
  interaction: ButtonInteraction
): Promise<void> {
  const userId = interaction.user.id;

  if (interaction.customId === BTN_UID_DELETE_CONFIRM) {
    const deleted = deleteZzzUid(userId);

    if (deleted) {
      await interaction.update({
        content: "已刪除你的絕區零 UID",
        components: [],
      });
    } else {
      await interaction.update({
        content: "刪除失敗：你還沒有註冊 UID",
        components: [],
      });
    }
  } else if (interaction.customId === BTN_UID_DELETE_CANCEL) {
    await interaction.update({
      content: "已取消刪除",
      components: [],
    });
  }
}

// 刪除確認
async function handleDeleteConfirm(
  interaction: StringSelectMenuInteraction,
  userId: string
): Promise<void> {
  const existingUid = getZzzUid(userId);

  if (!existingUid) {
    await interaction.update({
      content: "你還沒有註冊 UID",
      components: [],
    });
    return;
  }

  await interaction.update({
    content: `確定要刪除你的 UID \`${existingUid}\` 嗎？`,
    components: [createDeleteConfirmButtons()],
  });
}

// 統計
async function handleStats(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const allUids = getAllZzzUids();
  const totalUsers = Object.keys(allUids).length;

  const embed = new EmbedBuilder()
    .setTitle("絕區零 UID 註冊帳戶統計")
    .addFields({
      name: "總註冊人數",
      value: totalUsers.toString(),
      inline: true,
    })
    .setColor(0xffa500)
    .setFooter({ text: "系統報告" });

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [],
  });
}

// 個人資料
async function handleProfile(
  interaction: ChatInputCommandInteraction,
  userId: string
): Promise<void> {
  const uid = getZzzUid(userId);

  if (!uid) {
    await interaction.reply({
      content:
        "你還沒有註冊 UID！請先使用 `/zenless-zone-zero` 選擇「UID 管理」註冊",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const result = await fetchPlayerShowcase(uid);

  if (!result.success || !result.data) {
    await interaction.editReply(
      `查詢失敗: ${result.error || "請確認 UID 是否正確，或稍後再試"}`
    );
    return;
  }

  const { player, characters } = result.data;

  // 建立玩家資訊 Embed
  const embed = new EmbedBuilder()
    .setTitle(player.nickname)
    .addFields(
      { name: "UID", value: player.uid, inline: true },
      { name: "等級", value: player.level.toString(), inline: true }
    )
    .setColor(0xffa500)
    .setFooter({ text: "資料源自 Enka.Network" });

  // 設置頭像
  if (player.avatar_url) {
    embed.setThumbnail(player.avatar_url);
  }

  // 有簽名才顯示
  if (player.signature) {
    embed.setDescription(player.signature);
  }

  await interaction.editReply({ embeds: [embed] });
}

// 處理角色選擇後的顯示
async function handleShowcaseCharacterSelect(
  interaction: StringSelectMenuInteraction,
  userId: string,
  charIndex: string
): Promise<void> {
  const cached = playerDataCache.get(userId);

  // 檢查快取是否過期
  if (!cached || Date.now() - cached.timestamp > CACHE_TTL) {
    playerDataCache.delete(userId);
    await interaction.update({
      content: "資料已過期，請重新使用 `/zenless-zone-zero` 選擇「帳戶展示」",
      embeds: [],
      components: [],
    });
    return;
  }

  const { player, characters } = cached.data;
  const index = parseInt(charIndex);
  const char = characters[index];

  if (!char) {
    await interaction.update({
      content: "找不到該角色",
      embeds: [],
      components: [],
    });
    return;
  }

  // 建立角色詳細 Embed
  const embed = new EmbedBuilder()
    .setTitle(char.name)
    .setDescription(`${player.nickname} 的展示角色`)
    .setColor(getElementColor(char.element))
    .setFooter({ text: "資料源自 Enka.Network" });

  // 基本資訊
  embed.addFields(
    { name: "等級", value: `Lv.${char.level}`, inline: true },
    {
      name: "影視廳位階",
      value: char.rank > 0 ? `M${char.rank}` : "M0",
      inline: true,
    },
    {
      name: "稀有度",
      value: `${char.rarity === 4 ? "S" : "A"} 級`,
      inline: true,
    }
  );

  // 元素和專長
  if (char.element) {
    embed.addFields({ name: "屬性", value: char.element, inline: true });
  }
  if (char.specialty) {
    embed.addFields({ name: "專長", value: char.specialty, inline: true });
  }

  // W-Engine (武器)
  if (char.w_engine) {
    const engine = char.w_engine;
    const refinement = engine.rank > 1 ? ` [精${engine.rank}]` : "";
    embed.addFields({
      name: "W-Engine",
      value: `**${engine.name}** Lv.${engine.level}${refinement}`,
      inline: false,
    });
  }

  // 設置圖標（如果有）
  if (char.icon) {
    embed.setThumbnail(char.icon);
  }

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [],
  });

  // 清除快取
  playerDataCache.delete(userId);
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
