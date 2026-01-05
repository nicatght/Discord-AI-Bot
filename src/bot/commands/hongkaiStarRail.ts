/**
 * 崩壞星穹鐵道指令 - Autocomplete + Select Menu 混搭
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
import { fetchPlayerInfo } from "../../services/hsrService";
import { getHsrUid, setHsrUid, deleteHsrUid, getAllHsrUids } from "../../db";

// Autocomplete 選項
const ACTION_CHOICES = [
  { name: "UID 管理", value: "uid" },
  { name: "個人資料", value: "profile" },
  { name: "展示角色", value: "showcase" },
  { name: "兌換碼查詢", value: "codes" },
];

// Custom IDs
const MENU_UID = "hsr_menu_uid";
const MENU_SHOWCASE_CHAR = "hsr_menu_showcase_char";
const MODAL_UID_ADD = "hsr_modal_uid_add";
const MODAL_UID_INPUT = "hsr_modal_uid_input";
const BTN_UID_DELETE_CONFIRM = "hsr_btn_uid_delete_confirm";
const BTN_UID_DELETE_CANCEL = "hsr_btn_uid_delete_cancel";

// 暫存玩家資料（用於 showcase 選角後顯示）
const playerDataCache = new Map<string, { player: Awaited<ReturnType<typeof fetchPlayerInfo>>; timestamp: number }>();
const CACHE_TTL = 60000; // 1 分鐘

// 定義指令
export const data = new SlashCommandBuilder()
  .setName("honkai-star-rail")
  .setDescription("崩壞: 星穹鐵道 相關指令")
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
    // 已註冊：顯示更換和刪除選項
    select.addOptions([
      { label: "更換 UID", value: "add", description: "更換新的 UID" },
      { label: "刪除 UID", value: "delete", description: "解除綁定" },
      { label: "查看統計", value: "stats", description: "查看 UID 註冊統計" },
    ]);
  } else {
    // 未註冊：顯示註冊選項
    select.addOptions([
      { label: "註冊 UID", value: "add", description: "綁定你的崩鐵 UID" },
      { label: "查看統計", value: "stats", description: "查看 UID 註冊統計" },
    ]);
  }

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

// 執行指令
export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const action = interaction.options.getString("action", true);
  const userId = interaction.user.id;

  switch (action) {
    case "uid": {
      const existingUid = getHsrUid(userId);
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

    case "showcase":
      await handleShowcase(interaction, userId);
      break;

    case "codes":
      await interaction.reply({
        content: "兌換碼功能開發中...",
        flags: MessageFlags.Ephemeral,
      });
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
    .setTitle("崩鐵 UID 註冊帳戶統計")
    .addFields({
      name: "總註冊人數",
      value: totalUsers.toString(),
      inline: true,
    })
    .setColor(0x7c3aed)
    .setFooter({ text: "吉娃喵系統 報告" });

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
  const uid = getHsrUid(userId);

  if (!uid) {
    await interaction.reply({
      content: "你還沒有註冊 UID！請先使用 `/honkai-star-rail` 選擇「UID 管理」註冊",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const player = await fetchPlayerInfo(uid);

  if (!player) {
    await interaction.editReply("查詢失敗，請確認 UID 是否正確，或稍後再試");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(player.nickname)
    .setThumbnail(player.profilePictureUrl)
    .addFields(
      { name: "UID", value: player.uid, inline: true },
      { name: "開拓等級", value: player.level.toString(), inline: true }
    )
    .setColor(0x7c3aed)
    .setFooter({ text: "資料源自 MiHoMo" });

  // 有簽名才顯示
  if (player.signature) {
    embed.setDescription(player.signature);
  }

  await interaction.editReply({ embeds: [embed] });
}

// 展示角色 - 顯示角色選擇選單
async function handleShowcase(
  interaction: ChatInputCommandInteraction,
  userId: string
): Promise<void> {
  const uid = getHsrUid(userId);

  if (!uid) {
    await interaction.reply({
      content: "你還沒有註冊 UID！請先使用 `/honkai-star-rail` 選擇「UID 管理」註冊",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const player = await fetchPlayerInfo(uid);

  if (!player) {
    await interaction.editReply("查詢失敗，請確認 UID 是否正確，或稍後再試");
    return;
  }

  if (player.characters.length === 0) {
    await interaction.editReply("沒有展示角色！請在遊戲中設定展示角色");
    return;
  }

  // 暫存玩家資料
  playerDataCache.set(userId, { player, timestamp: Date.now() });

  // 建立角色選擇選單
  const select = new StringSelectMenuBuilder()
    .setCustomId(MENU_SHOWCASE_CHAR)
    .setPlaceholder("選擇要展示的角色")
    .addOptions(
      player.characters.map((char, index) => ({
        label: char.name,
        value: index.toString(),
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.editReply({
    content: "請選擇要展示的角色：",
    components: [row],
  });
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
      content: "資料已過期，請重新使用 `/honkai-star-rail` 選擇「展示角色」",
      components: [],
    });
    return;
  }

  const player = cached.player;
  if (!player) {
    await interaction.update({
      content: "查詢失敗，請稍後再試",
      components: [],
    });
    return;
  }

  const index = parseInt(charIndex);
  const char = player.characters[index];

  if (!char) {
    await interaction.update({
      content: "找不到該角色",
      components: [],
    });
    return;
  }

  // 清除快取
  playerDataCache.delete(userId);

  // 先更新原本的私人訊息
  await interaction.update({
    content: `已選擇 **${char.name}**`,
    components: [],
  });

  // 公開發送角色資訊
  const embed = new EmbedBuilder()
    .setTitle(char.name)
    .setDescription(`${player.nickname} 的展示角色`)
    .setImage(char.splashUrl)
    .setThumbnail(char.iconUrl)
    .setColor(0x7c3aed)
    .setFooter({ text: "Data from MiHoMo API" });

  if (char.lightCone) {
    embed.addFields({ name: "光錐", value: char.lightCone, inline: true });
  }

  await interaction.followUp({ embeds: [embed] });
}
