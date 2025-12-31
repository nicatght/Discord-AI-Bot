import { Message } from 'discord.js';

export async function messageHandler(message: Message): Promise<void> {
  // TODO: 实现消息处理逻辑
  console.log(`收到消息: ${message.content}`);
}

