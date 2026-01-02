import { Collection, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import * as ping from "./ping";

// 指令介面
export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// 所有指令集合
export const commands = new Collection<string, Command>();

// 註冊所有指令
commands.set(ping.data.name, ping);
