/**
 * 崩壞星穹鐵道指令 - 使用 Select Menu + Modal
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
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
import { fetchPlayerInfo } from "../../services/hsrService";
import { getHsrUid, setHsrUid, deleteHsrUid, getAllHsrUids } from "../../db";

// Custom IDs
const MENU_MAIN = "hsr_menu_main";
const MENU_UID = "hsr_menu_uid";
const MODAL_UID_ADD = "hsr_modal_uid_add";
const MODAL_UID_INPUT = "hsr_modal_uid_input";
const BTN_UID_DELETE_CONFIRM = "hsr_btn_uid_delete_confirm";
const BTN_UID_DELETE_CANCEL = "hsr_btn_uid_delete_cancel";

// 定義指令
export const data = new SlashCommandBuilder()
  .setName("honkai-star-rail")
  .setDescription("崩壞: 星穹鐵道 相關指令");

// 主選單
function createMainMenu() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(MENU_MAIN)
    .setPlaceholder("選擇功能")
    .addOptions([
      { label: "UID 管理", value: "uid", description: "註冊、刪除、查看 UID" },
      {
        label: "展示角色",
        value: "characters",
        description: "查看你的展示角色",
      },
      { label: "兌換碼查詢", value: "codes", description: "查看最新兌換碼" },
    ]);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

// UID 子選單
function createUidMenu() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(MENU_UID)
    .setPlaceholder("選擇 UID 操作")
    .addOptions([
      { label: "註冊 UID", value: "add", description: "綁定你的崩鐵 UID" },
      { label: "顯示 UID", value: "show", description: "顯示你的 UID 到公頻" },
      { label: "刪除 UID", value: "delete", description: "解除綁定" },
      { label: "查看統計", value: "stats", description: "查看 uid 註冊統計" },
    ]);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

// 刪除確認按鈕
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

// 執行指令 - 顯示主選單
export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.reply({
    content: "請選擇功能：",
    components: [createMainMenu()],
    flags: MessageFlags.Ephemeral,
  });
}

// 處理 Select Menu 互動
export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const value = interaction.values[0];

  // 主選單
  if (interaction.customId === MENU_MAIN) {
    switch (value) {
      case "uid":
        await interaction.update({
          content: "請選擇 UID 操作：",
          components: [createUidMenu()],
        });
        break;

      case "characters":
        await handleCharacters(interaction, userId);
        break;

      case "codes":
        await interaction.update({
          content: "兌換碼功能開發中...",
          components: [],
        });
        break;
    }
    return;
  }

  // UID 子選單
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
  }
}

// 顯示 UID 輸入 Modal
async function showUidModal(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_UID_ADD)
    .setTitle("註冊崩鐵 UID");

  const uidInput = new TextInputBuilder()
    .setCustomId(MODAL_UID_INPUT)
    .setLabel("請輸入你的 UID（9-10 位數字）")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("例如: 800123456")
    .setMinLength(9)
    .setMaxLength(10)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(uidInput);
  modal.addComponents(row);

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
  if (!/^\d{9,10}$/.test(uid)) {
    await interaction.reply({
      content: "UID 格式錯誤！請輸入 9 或 10 位數字",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await setHsrUid(userId, uid);

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
    const deleted = deleteHsrUid(userId);

    if (deleted) {
      await interaction.update({
        content: "已刪除你的崩鐵 UID",
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
  const existingUid = getHsrUid(userId);

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
  const allUids = getAllHsrUids();
  const totalUsers = Object.keys(allUids).length;

  const embed = new EmbedBuilder()
    .setTitle("HSR UID 註冊統計")
    .addFields({
      name: "總註冊人數",
      value: totalUsers.toString(),
      inline: true,
    })
    .setColor(0x7c3aed)
    .setFooter({ text: "Honkai: Star Rail UID System" });

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [],
  });
}

// 展示角色
async function handleCharacters(
  interaction: StringSelectMenuInteraction,
  userId: string
): Promise<void> {
  const uid = getHsrUid(userId);

  if (!uid) {
    await interaction.update({
      content: "你還沒有註冊 UID！請先選擇「UID 管理」->「註冊 UID」",
      components: [createMainMenu()],
    });
    return;
  }

  await interaction.update({
    content: "查詢中...",
    components: [],
  });

  const player = await fetchPlayerInfo(uid);

  if (!player) {
    await interaction.editReply({
      content: "查詢失敗，請確認 UID 是否正確，或稍後再試",
    });
    return;
  }

  if (player.characters.length === 0) {
    await interaction.editReply({
      content: "沒有展示角色！請在遊戲中設定展示角色",
    });
    return;
  }

  const characterList = player.characters
    .map((char) => {
      const lc = char.lightCone ? ` | ${char.lightCone}` : "";
      return `**${char.name}** Lv.${char.level} (${char.element})${lc}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`${player.nickname} 的展示角色`)
    .setDescription(characterList)
    .setThumbnail(player.profilePictureUrl)
    .setColor(0x7c3aed)
    .setFooter({ text: "Data from MiHoMo API" });

  await interaction.editReply({
    content: "",
    embeds: [embed],
  });
}
