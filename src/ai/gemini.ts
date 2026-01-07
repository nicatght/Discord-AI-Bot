/**
 * Gemini AI 服務
 *
 * 使用 @google/genai SDK（新版）
 * 支援 Google Search Grounding 功能
 */

import { GoogleGenAI } from "@google/genai";
import { config } from "../config";

// Gemini 客戶端（延遲初始化）
let genAI: GoogleGenAI | null = null;

/**
 * 取得 Gemini 客戶端
 */
function getClient(): GoogleGenAI {
  if (!genAI) {
    if (!config.gemini.apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }
    genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return genAI;
}

/**
 * 使用 Google Search Grounding 查詢
 *
 * @param prompt - 查詢內容
 * @returns 回應文字
 */
export async function searchWithGrounding(prompt: string): Promise<string> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: config.gemini.model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text || "No response";
}

/**
 * 查詢遊戲兌換碼
 *
 * @param game - 遊戲名稱（hsr, zzz, genshin）
 * @returns 兌換碼資訊
 */
export async function searchRedemptionCodes(
  game: "hsr" | "zzz" | "genshin"
): Promise<string> {
  const gameNames: Record<string, string> = {
    hsr: "Honkai Star Rail (崩壞：星穹鐵道)",
    zzz: "Zenless Zone Zero (絕區零)",
    genshin: "Genshin Impact (原神)",
  };

  const gameName = gameNames[game] || game;

  // 取得目前時間（台灣時區）
  const now = new Date();
  const currentDate = now.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  });

  const prompt = `現在時間：${currentDate}

請搜尋 ${gameName} 最新的兌換碼 (redemption codes / redeem codes)。

要求：
1. 只列出目前仍然有效、可以使用的兌換碼 **只要兌換碼有顯示 "已過期" 則不要回傳**
2. 每個兌換碼請說明獎勵內容
3. 只回傳對「國際服」有效的兌換碼（排除僅限國服/中國服的兌換碼）
4. 如果有到期日期請標註
5. 只回傳官方在最近 7 天內發布的兌換碼（DO NOT return code that is released before 7 days ago.）
6. 用繁體中文回答
7. 格式範例：
- ABCD1234 - 星瓊x50、信用點x10000（到期：2025/1/31）
8. 如果該兌換碼是前瞻直播釋出的 在額外備註。
範例:
- ABCD1234 - 星瓊x50、信用點x10000（到期：2025/1/31） **<前瞻直播>**
9. 如果沒有任何搜尋結果，則回覆: "未找到兌換碼"
10. 請勿加入過多解釋，包含: 如何使用，注意事項等等。

如果找不到有效的兌換碼，請說明目前沒有可用的兌換碼。`;

  return searchWithGrounding(prompt);
}

/**
 * 檢查 Gemini API 是否可用
 */
export function isGeminiEnabled(): boolean {
  return !!config.gemini.apiKey;
}
