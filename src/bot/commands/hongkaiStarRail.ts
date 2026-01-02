/**
 * 崩壞星穹鐵道指令
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { fetchPlayerInfo } from "../../services/hsrService";
import { getHsrUid, setHsrUid, deleteHsrUid } from "../../db";

// 定義指令（含子指令群組）
export const data = new SlashCommandBuilder()
  .setName("honkai-star-rail")
  .setDescription("崩壞: 星穹鐵道 相關指令")

  // 子指令群組: uid 管理
  .addSubcommandGroup((group) =>
    group
      .setName("uid")
      .setDescription("UID 管理")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add")
          .setDescription("註冊你的崩鐵 UID")
          .addStringOption((option) =>
            option.setName("uid").setDescription("你的 UID").setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("delete").setDescription("刪除你的崩鐵 UID")
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("stats").setDescription("查看崩鐵uid存取資訊")
      )
  )

  // 子指令: 查看角色列表
  .addSubcommand((subcommand) =>
    subcommand.setName("characters").setDescription("查看崩鐵展示角色")
  )

  // 子指令: 兌換碼（TODO）
  .addSubcommand((subcommand) =>
    subcommand.setName("codes").setDescription("查看最新兌換碼")
  );

// 執行指令
export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  // uid 子指令群組
  if (subcommandGroup === "uid") {
    switch (subcommand) {
      case "add": {
        const uid = interaction.options.getString("uid", true);

        // 驗證 UID 格式（9 或 10 位數字）
        if (!/^\d{9,10}$/.test(uid)) {
          await interaction.reply({
            content:
              "UID 格式錯誤！請輸入 9 或 10 位數字的 UID (如果有其他格式找 九貓 開issue)",
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply();

        const result = await setHsrUid(userId, uid);

        if (result.success) {
          await interaction.editReply(
            `已註冊 UID: \`${uid}\`\n玩家名稱: **${result.nickname}**`
          );
        } else {
          await interaction.editReply(`註冊失敗: \n${result.error}`);
        }
        break;
      }

      case "delete": {
        const deleted = deleteHsrUid(userId);

        if (deleted) {
          await interaction.reply("已刪除你的崩鐵 UID");
        } else {
          await interaction.reply({
            content: "你還沒有註冊 UID",
            ephemeral: true,
          });
        }
        break;
      }

      case "stats": {
        const uid = getHsrUid(userId);

        if (!uid) {
          await interaction.reply({
            content:
              "你還沒有註冊 UID！請先使用 `/honkai-star-rail uid add` 註冊",
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply();

        const player = await fetchPlayerInfo(uid);

        if (!player) {
          await interaction.editReply(
            "查詢失敗，請確認 UID 是否正確，或稍後再試"
          );
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(player.nickname)
          .setDescription(player.signature || "No signature")
          .setThumbnail(player.profilePictureUrl)
          .addFields(
            { name: "UID", value: player.uid, inline: true },
            { name: "開拓等級", value: player.level.toString(), inline: true },
            {
              name: "均衡等級",
              value: player.worldLevel.toString(),
              inline: true,
            },
            {
              name: "展示角色數",
              value: player.characters.length.toString(),
              inline: true,
            }
          )
          .setColor(0x7c3aed)
          .setFooter({ text: "Data from MiHoMo API" });

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
    return;
  }

  // 其他子指令
  switch (subcommand) {
    case "characters": {
      const uid = getHsrUid(userId);

      if (!uid) {
        await interaction.reply({
          content:
            "你還沒有註冊 UID！請先使用 `/honkai-star-rail uid add` 註冊",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      const player = await fetchPlayerInfo(uid);

      if (!player) {
        await interaction.editReply(
          "查詢失敗，請確認 UID 是否正確，或稍後再試"
        );
        return;
      }

      if (player.characters.length === 0) {
        await interaction.editReply("沒有展示角色！請在遊戲中設定展示角色");
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

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case "codes": {
      // TODO: 實作兌換碼查詢
      await interaction.reply("兌換碼功能開發中...");
      break;
    }

    default:
      await interaction.reply("未知的子指令");
  }
}
