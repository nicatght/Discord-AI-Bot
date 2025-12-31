import { Message } from 'discord.js';

// 规则过滤（方案B第一层）
export function shouldProcessMessage(message: Message): boolean {
  const content = message.content.toLowerCase();
  
  // TODO: 实现过滤规则
  // - 检查是否包含问号
  // - 检查是否 @机器人
  // - 检查关键词等
  
  return false; // 临时返回
}

