/**
 * 資料同步服務
 *
 * 在機器人啟動時檢查本地與雲端（JSONBin.io）的資料是否一致。
 * 若不一致，發送 Discord 訊息讓管理員選擇要使用哪個版本。
 *
 * 流程：
 * 1. 讀取本地 uid.json
 * 2. 讀取 JSONBin.io 資料
 * 3. 比較兩者是否相同
 * 4. 若不同，發送訊息到指定頻道讓管理員選擇
 * 5. 根據選擇同步資料
 */

import {
  Client,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ButtonInteraction,
  ComponentType,
} from "discord.js";
import { loadUidData, saveUidData } from "../db/storage";
import {
  isJsonBinEnabled,
  readFromJsonBin,
  writeToJsonBin,
  initializeJsonBin,
  UidData,
} from "./jsonBinService";
import { config } from "../config";

// 同步訊息的自訂 ID 前綴
const SYNC_BUTTON_PREFIX = "sync_data_";

/**
 * 比較兩個物件是否相同（深度比較）
 */
function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 確保本地檔案存在
 *
 * 如果是新環境，本地可能沒有 uid.json 檔案。
 * 這個函數會在同步開始前確保檔案存在。
 * loadUidData() 會在檔案不存在時回傳空的 UidData 結構。
 */
function ensureLocalFileExists(): void {
  // loadUidData() 會處理檔案不存在的情況
  // 這裡先讀取再儲存，確保檔案存在且格式正確
  const data = loadUidData();
  saveUidData(data);
  console.log("[DataSync] Local file ensured");
}

/**
 * 計算資料筆數
 */
function countEntries(data: Record<string, string>): number {
  return Object.keys(data).length;
}

/**
 * 啟動時檢查資料同步狀態
 *
 * @param client - Discord Client（已登入）
 * @returns 是否需要等待使用者選擇（true = 有衝突需處理）
 */
export async function checkDataSync(client: Client): Promise<boolean> {
  // 如果 JSONBin 未啟用，跳過檢查
  if (!isJsonBinEnabled()) {
    console.log("[DataSync] JSONBin not configured, skipping sync check");
    return false;
  }

  console.log("[DataSync] Checking data sync status...");

  // 1. 確保本地檔案存在
  ensureLocalFileExists();

  // 2. 讀取本地資料（使用 CloudData 格式）
  const localData = loadUidData();

  // 3. 初始化 JSONBin（確保雲端有初始資料結構）
  await initializeJsonBin();

  // 4. 讀取雲端資料
  const cloudData = await readFromJsonBin<UidData>();

  // 如果雲端讀取失敗，同步本地資料到雲端
  if (cloudData === null || !cloudData.active) {
    console.log("[DataSync] Failed to read cloud data, syncing local data to cloud");
    await writeToJsonBin(localData);
    return false;
  }

  // 5. 比較本地與雲端資料（整個 UidData 結構）
  if (isEqual(localData, cloudData)) {
    console.log("[DataSync] Data is in sync");
    return false;
  }

  // 6. 資料不同，發送訊息讓管理員選擇
  console.log("[DataSync] Data conflict detected, sending resolution message");
  await sendConflictMessage(client, localData, cloudData);
  return true;
}

/**
 * 發送資料衝突訊息到 Discord
 */
async function sendConflictMessage(
  client: Client,
  localData: UidData,
  cloudData: UidData
): Promise<void> {
  // 取得第一個可用的文字頻道
  const guild = client.guilds.cache.get(config.discord.guildId);
  if (!guild) {
    console.error("[DataSync] Guild not found");
    return;
  }

  // 找到第一個機器人可以發送訊息的文字頻道
  const channel = guild.channels.cache.find(
    (ch) =>
      ch.isTextBased() &&
      ch.type === 0 && // 0 = GuildText
      ch.permissionsFor(client.user!)?.has("SendMessages")
  ) as TextChannel | undefined;

  if (!channel) {
    console.error("[DataSync] No suitable text channel found");
    return;
  }

  // 計算各遊戲的資料筆數
  const localHsrCount = countEntries(localData.hsr);
  const cloudHsrCount = countEntries(cloudData.hsr);
  const localZzzCount = countEntries(localData.zzz);
  const cloudZzzCount = countEntries(cloudData.zzz);

  // 建立 Embed
  const embed = new EmbedBuilder()
    .setTitle("\u26A0\uFE0F UID 資料不同步")
    .setDescription(
      "偵測到本地與雲端資料不一致，請選擇要使用哪個版本。\n" +
        "**被選擇的版本會覆蓋另一個版本。**\n\n" +
        `[A] 本地資料: HSR ${localHsrCount} 筆, ZZZ ${localZzzCount} 筆\n` +
        `[B] 雲端資料: HSR ${cloudHsrCount} 筆, ZZZ ${cloudZzzCount} 筆`
    )
    .setColor(0xffa500) // 橘色警告
    .setFooter({ text: "請在 60 秒內選擇，否則將使用本地資料" })
    .setTimestamp();

  // 建立按鈕
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SYNC_BUTTON_PREFIX}local`)
      .setLabel("[A] 使用本地資料")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${SYNC_BUTTON_PREFIX}cloud`)
      .setLabel("[B] 使用雲端資料")
      .setStyle(ButtonStyle.Secondary)
  );

  // 發送訊息
  const message = await channel.send({
    embeds: [embed],
    components: [row],
  });

  // 等待按鈕回應（60 秒超時）
  try {
    const interaction = await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.customId.startsWith(SYNC_BUTTON_PREFIX),
      time: 60000, // 60 秒
    });

    await handleSyncChoice(interaction, localData, cloudData);
  } catch {
    // 超時，使用本地資料同步到雲端
    console.log("[DataSync] Timeout, using local data");
    await writeToJsonBin(localData);

    // 更新訊息
    const timeoutEmbed = EmbedBuilder.from(embed)
      .setColor(0x808080) // 灰色
      .setFooter({ text: "已超時，自動使用本地資料" });

    await message.edit({
      embeds: [timeoutEmbed],
      components: [], // 移除按鈕
    });
  }
}

/**
 * 處理同步選擇
 */
async function handleSyncChoice(
  interaction: ButtonInteraction,
  localData: UidData,
  cloudData: UidData
): Promise<void> {
  const choice = interaction.customId.replace(SYNC_BUTTON_PREFIX, "");

  if (choice === "local") {
    // 使用本地資料，同步到雲端
    await writeToJsonBin(localData);
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("\u2705 資料同步完成")
          .setDescription("已選擇 **本地資料**，雲端資料已更新。")
          .setColor(0x00ff00),
      ],
      components: [],
    });
    console.log("[DataSync] Using local data, synced to cloud");
  } else if (choice === "cloud") {
    // 使用雲端資料，同步到本地
    saveUidData(cloudData);
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("\u2705 資料同步完成")
          .setDescription("已選擇 **雲端資料**，本地資料已更新。")
          .setColor(0x00ff00),
      ],
      components: [],
    });
    console.log("[DataSync] Using cloud data, synced to local");
  }
}
