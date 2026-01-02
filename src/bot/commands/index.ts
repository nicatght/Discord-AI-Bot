import { Collection, ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import * as ping from "./ping";
import * as hsr from "./hongkaiStarRail";

// 指令介面（支援一般指令和含子指令的指令）
export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// 指令集合
export const commands = new Collection<string, Command>();

// 註冊所有指令
commands.set(ping.data.name, ping);
commands.set(hsr.data.name, hsr);
