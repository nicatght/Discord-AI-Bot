import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import { messageHandler } from "./handlers/messageHandler";
import { commandHandler } from "./handlers/commandHandler";
import { commands } from "./commands";
import { config } from "../config";

// 建立 Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(`啟動成功 以${client.user?.tag}登入`);
});

client.on("error", (error) => {
  console.error("[ERROR] dc 機器人:", error);
});

client.on("warn", (warning) => {
  console.warn("[WARN] dc 機器人:", warning);
});

client.on("messageCreate", async (message) => {
  // 忽略機器人的訊息
  if (message.author.bot) return;
  await messageHandler(message);
});

// 處理 Slash 指令
client.on("interactionCreate", async (interaction) => {
  await commandHandler(interaction);
});

// 向伺服器註冊 Slash 指令 (這也是指定伺服器的原因)
async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(config.discord.token);
  const commandData = commands.map((cmd) => cmd.data.toJSON());
  const guildId = config.discord.guildId;

  if (!guildId) {
    console.error("[ERROR] DISCORD_GUILD_ID not set in .env");
    console.error("   1. 開啟 discord 開發者模式");
    console.error("   2. 右鍵點擊你的伺服器圖示");
    console.error("   3. 點擊複製伺服器 ID");
    console.error("   4. 將複製的ID放在 .env 的 DISCORD_GUILD_ID 裡");
    
    return;
  }

  try {
    console.log("[INFO] 註冊 / 指令 到 伺服器...");

    await rest.put(
      Routes.applicationGuildCommands(client.user!.id, guildId),
      { body: commandData }
    );

    console.log("[INFO] 成功註冊指令!");
  } catch (error) {
    console.error("[ERROR] 指令註冊錯誤:", error);
  }
}

// Bot 連線
export async function startBot(): Promise<void> {
  try {

    await client.login(config.discord.token);
    await registerCommands();

  } catch (error: any) {
    // 錯誤回饋
    console.error("[ERROR] Login failed:", error.message);

    if (
      error.message.includes("disallowed intents") ||
      error.message.includes("intents")
    ) {
      console.error("\n[ERROR] Intent not enabled:");
      console.error("   1. Go to https://discord.com/developers/applications");
      console.error("   2. Select your Bot application");
      console.error('   3. Select "Bot" from the left menu');
      console.error('   4. Scroll down to "Privileged Gateway Intents"');
      console.error('   5. Enable "MESSAGE CONTENT INTENT"');
      console.error("   6. Save changes");
      console.error("   7. Restart the program");
    } else if (error.code === "TokenInvalid") {
      console.error("\n[ERROR] Invalid token:");
      console.error(
        "   1. Token expired or reset - check Discord Developer Portal"
      );
      console.error(
        "   2. Token format error - make sure no extra spaces or quotes"
      );
      console.error("   3. Token leaked - if public, reset immediately");
    } else {
      console.error("\n[ERROR] Fail to Login into discord Bot");
      console.error("   error code: " + error.code);
      console.error("   error message: " + error.message);
    }

    process.exit(1);
  }
}

export { client };
