import { Interaction, MessageFlags } from "discord.js";
import { commands } from "../commands";
import * as hsrCommand from "../commands/hongkaiStarRail";

export async function commandHandler(interaction: Interaction): Promise<void> {
  try {
    // Autocomplete
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === "honkai-star-rail") {
        await hsrCommand.autocomplete(interaction);
      }
      return;
    }

    // Slash Command
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);

      if (!command) {
        console.error(`[ERROR] Command not found: ${interaction.commandName}`);
        return;
      }

      await command.execute(interaction);
      return;
    }

    // Select Menu
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("hsr_")) {
        await hsrCommand.handleSelectMenu(interaction);
      }
      return;
    }

    // Modal Submit
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("hsr_")) {
        await hsrCommand.handleModalSubmit(interaction);
      }
      return;
    }

    // Button
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("hsr_")) {
        await hsrCommand.handleButton(interaction);
      }
      return;
    }
  } catch (error) {
    console.error(`[ERROR] Interaction failed:`, error);

    // 錯誤處理
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "Command failed!", flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: "Command failed!", flags: MessageFlags.Ephemeral });
      }
    }
  }
}
