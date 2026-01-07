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
    // 使用完整的 Content[] 格式，比直接傳 string 更明確
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text || "No response";
}

// 各遊戲的兌換碼連結模板
const REDEEM_URLS: Record<string, string> = {
  hsr: "https://hsr.hoyoverse.com/gift?code=",
  zzz: "https://zenless.hoyoverse.com/redemption?code=",
  genshin: "https://genshin.hoyoverse.com/gift?code=",
};

// 兌換碼資料結構
interface RedemptionCode {
  code: string;
  rewards: string;
  expiry?: string;
  isLivestream?: boolean;
}

/**
 * 將 JSON 格式的兌換碼轉換為 Discord 訊息格式
 */
function formatRedemptionCodes(codes: RedemptionCode[], game: string): string {
  const baseUrl = REDEEM_URLS[game];
  if (!baseUrl || codes.length === 0) {
    return "目前沒有可用的兌換碼";
  }

  return codes
    .map((item) => {
      // 建立可點擊的連結
      const codeLink = `[${item.code}](${baseUrl}${item.code})`;
      // 組合獎勵內容
      let line = `- ${codeLink} - ${item.rewards}`;
      // 加入到期日（如果有）
      if (item.expiry) {
        line += `（到期：${item.expiry}）`;
      }
      // 加入前瞻直播標記（如果有）
      if (item.isLivestream) {
        line += " **<前瞻直播>**";
      }
      return line;
    })
    .join("\n");
}

/**
 * 從 AI 回應中解析 JSON
 *
 * 解析策略（按優先順序）：
 * 1. 優先抓 markdown code block 內的 JSON
 * 2. 嘗試找標準 JSON array
 * 3. 嘗試解析 NDJSON（每行一個 JSON object）
 * 4. 處理空陣列的情況
 */
function parseRedemptionCodesJson(text: string): RedemptionCode[] | null {
  try {
    let jsonStr: string | null = null;

    // 策略 1: 優先抓 ```json ... ``` code block
    const blockMatch = text.match(/```json?\s*([\s\S]*?)```/i);
    if (blockMatch) {
      jsonStr = blockMatch[1].trim();
    }

    // 策略 2: 嘗試找 JSON array（從 [{ 開始到對應的 }] 結束）
    if (!jsonStr) {
      const arrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
    }

    // 策略 3: 嘗試解析 NDJSON（每行一個 JSON object）
    // AI 有時會回傳這種格式：
    // {"code": "...", ...}
    // {"code": "...", ...}
    if (!jsonStr) {
      const lines = text
        .split("\n")
        .filter((line) => line.trim().startsWith("{"));
      if (lines.length > 0) {
        const objects: RedemptionCode[] = [];
        for (const line of lines) {
          try {
            const obj = JSON.parse(line.trim());
            if (obj.code && obj.rewards) {
              objects.push(obj);
            }
          } catch {
            // 跳過無法解析的行
          }
        }
        if (objects.length > 0) {
          // 去除重複的兌換碼
          const seen = new Set<string>();
          return objects.filter((item) => {
            if (seen.has(item.code)) return false;
            seen.add(item.code);
            return true;
          });
        }
      }
    }

    // 策略 4: 處理空陣列 []
    if (!jsonStr) {
      const emptyArrayMatch = text.match(/\[\s*\]/);
      if (emptyArrayMatch) {
        return [];
      }
    }

    if (!jsonStr) {
      console.log("[parseRedemptionCodesJson] 找不到 JSON");
      return null;
    }

    const parsed = JSON.parse(jsonStr);

    // 驗證格式
    if (!Array.isArray(parsed)) {
      console.log("[parseRedemptionCodesJson] 不是陣列");
      return null;
    }

    return parsed as RedemptionCode[];
  } catch (error) {
    console.log("[parseRedemptionCodesJson] 解析失敗:", error);
    return null;
  }
}

/**
 * 查詢遊戲兌換碼
 *
 * @param game - 遊戲名稱（hsr, zzz, genshin）
 * @returns 兌換碼資訊（含可點擊連結）
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

  // 日期格式化選項
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  };

  // 取得目前時間（台灣時區）
  const now = new Date();
  const currentDate = now.toLocaleDateString("zh-TW", dateOptions);

  const prompt = `現在時間：${currentDate}

請搜尋 ${gameName} 最新的兌換碼 (redemption codes / redeem codes)。

要求：
1. 只列出目前仍然有效、可以使用的兌換碼 **只要兌換碼有顯示 "已過期" 則不要回傳**
2. 只回傳對「國際服」有效的兌換碼（排除僅限國服/中國服的兌換碼）
3. 只回傳官方在最近 7 天內發布的兌換碼（DO NOT return code that is released before 7 days ago.）
4. 回傳的兌換碼**必須**符合以上3點要求
5. 如果有到期日期請標註
6. 用繁體中文回答
7. 最多回傳 5 個兌換碼，優先淘汰可信度較低 (較少資訊且非官方釋出) 的兌換碼，其次淘汰釋出時間較久的兌換碼。
8. 如果沒有任何兌換碼符合以上要求，則回傳空陣列：[]

請以 JSON 格式回傳，格式如下：
\`\`\`json
[
  {
    "code": "兌換碼",
    "rewards": "獎勵內容（繁體中文）",
    "expiry": "到期日期（如果有的話，格式：YYYY/MM/DD）",
    "isLivestream": true或false（是否為前瞻直播兌換碼）
  }
]
\`\`\`

只回傳 JSON，不要加入其他說明文字。`;

  const result = await searchWithGrounding(prompt);

  // 嘗試解析 JSON
  const codes = parseRedemptionCodesJson(result);

  // JSON 解析失敗
  if (codes === null) {
    console.log("[searchRedemptionCodes] JSON 解析失敗");
    console.log("[searchRedemptionCodes] AI 原始回應:", result);
    return "AI 回傳格式錯誤，請重新查詢";
  }

  // 沒有找到兌換碼（空陣列）
  if (codes.length === 0) {
    return "未找到符合條件的兌換碼";
  }

  // 成功解析，使用格式化函數
  return formatRedemptionCodes(codes, game);
}

/**
 * 檢查 Gemini API 是否可用
 */
export function isGeminiEnabled(): boolean {
  return !!config.gemini.apiKey;
}
