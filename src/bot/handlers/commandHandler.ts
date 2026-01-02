import { Interaction } from "discord.js";
import { commands } from "../commands";

export async function commandHandler(interaction: Interaction): Promise<void> {
  // 只處理 slash command
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`[ERROR] Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[ERROR] Command execution failed:`, error);

    // 如果還沒回覆，送出錯誤訊息
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: "Command failed!", ephemeral: true });
    } else {
      await interaction.reply({ content: "Command failed!", ephemeral: true });
    }
  }
}
