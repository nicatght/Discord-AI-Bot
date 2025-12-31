// TODO: 实现上下文管理（30条消息，频道共享）

export interface MessageContext {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class ContextManager {
  private contextMap: Map<string, MessageContext[]> = new Map();
  private maxMessages: number = 30;

  // TODO: 实现上下文管理方法
  // - addMessage(channelId, message)
  // - getContext(channelId)
  // - clearContext(channelId)
}

