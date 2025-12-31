import { GoogleGenerativeAI } from '@google/generative-ai';

// TODO: 实现 Gemini AI 封装
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  
  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // TODO: 实现 AI 对话方法
}

