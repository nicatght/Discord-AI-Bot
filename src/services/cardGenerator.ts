/**
 * Card Generator Service
 *
 * 負責呼叫 Python 腳本生成崩鐵角色卡片。
 *
 * 運作流程：
 * 1. 檢查快取是否需要更新（比對 hash）
 * 2. 如果需要更新，清除舊圖片並呼叫 Python 生成新圖片
 * 3. 更新快取 JSON
 * 4. 回傳圖片路徑
 *
 * 快取結構：
 * data/hsr/<uid>/
 *   cache.json    - hash 對照表
 *   <charId>.png  - 角色卡片圖片
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { HsrCharacter } from "./hsrService";
import {
  anyNeedsRegeneration,
  clearCardImages,
  updateCache,
  getCardImagePath,
  getCacheDirectory,
} from "./hsrCardCache";

// Python 相關路徑
const PYTHON_DIR = path.join(__dirname, "../../python");
const PYTHON_SCRIPT = path.join(PYTHON_DIR, "generate_card.py");

// 虛擬環境的 Python 執行檔路徑（Windows）
// uv 使用 .venv 目錄，傳統 venv 使用 venv 目錄
// 優先順序：.venv (uv) -> venv (傳統) -> 系統 python
const UV_VENV_PYTHON = path.join(PYTHON_DIR, ".venv", "Scripts", "python.exe");
const VENV_PYTHON = path.join(PYTHON_DIR, "venv", "Scripts", "python.exe");
const PYTHON_EXECUTABLE = fs.existsSync(UV_VENV_PYTHON)
  ? UV_VENV_PYTHON
  : fs.existsSync(VENV_PYTHON)
    ? VENV_PYTHON
    : "python";

/**
 * 批次生成結果
 */
export interface GenerateAllResult {
  success: boolean;
  cardPaths?: Record<string, string>; // charId -> filePath
  error?: string;
}

/**
 * 單一角色卡片結果
 */
export interface CardResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * 執行 Python 腳本並取得輸出
 *
 * @param args - 傳給 Python 腳本的參數
 * @returns Promise 解析為 stdout 內容
 *
 * spawn() 的運作方式：
 * - 建立新的子程序執行指定命令
 * - 監聽 'stdout' 取得正常輸出
 * - 監聽 'stderr' 取得錯誤輸出
 * - 'close' 事件在程序結束時觸發
 */
function runPython(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[CardGenerator] Using Python: ${PYTHON_EXECUTABLE}`);
    console.log(`[CardGenerator] Args: ${args.join(" ")}`);

    const process = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT, ...args]);

    let stdout = "";
    let stderr = "";

    // 收集 stdout
    process.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    // 收集 stderr（用於除錯）
    process.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // 程序結束時
    process.on("close", (code) => {
      if (code !== 0) {
        console.error(`[CardGenerator] Python stderr: ${stderr}`);
        reject(new Error(`Python process exited with code ${code}`));
        return;
      }

      resolve(stdout.trim());
    });

    // 處理程序錯誤（例如 Python 未安裝）
    process.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

/**
 * 解析 Python 腳本輸出
 *
 * 輸出格式：
 * - 成功: "SUCCESS:<data>"
 * - 失敗: "ERROR:<message>"
 */
function parseOutput(output: string): { success: boolean; data?: string; error?: string } {
  if (output.startsWith("SUCCESS:")) {
    return {
      success: true,
      data: output.substring(8),
    };
  } else if (output.startsWith("ERROR:")) {
    return {
      success: false,
      error: output.substring(6),
    };
  } else {
    return {
      success: false,
      error: `Unexpected output: ${output}`,
    };
  }
}

/**
 * 生成所有展櫃角色的卡片
 *
 * 這是主要的生成函數，會：
 * 1. 清除該 UID 目錄下的所有舊圖片
 * 2. 呼叫 Python 批次生成所有角色卡片
 * 3. 更新快取 JSON
 *
 * @param uid - 玩家 UID
 * @param characters - 角色列表（用於更新快取）
 * @param lang - 語言代碼
 * @param template - 卡片模板樣式
 */
async function generateAllCards(
  uid: string,
  characters: HsrCharacter[],
  lang: string = "cht",
  template: number = 3
): Promise<GenerateAllResult> {
  try {
    // 取得快取目錄路徑
    const cacheDir = getCacheDirectory(uid);

    // 清除舊圖片（避免殘留）
    clearCardImages(uid);

    console.log(`[CardGenerator] Generating all cards for UID ${uid}`);

    // 呼叫 Python 腳本生成所有卡片
    const output = await runPython([
      "generate_all",
      uid,
      "--output_dir",
      cacheDir,
      "--lang",
      lang,
      "--template",
      template.toString(),
    ]);

    const result = parseOutput(output);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Unknown error",
      };
    }

    // 解析 Python 回傳的 JSON（charId -> filePath 對照）
    const cardPaths = JSON.parse(result.data) as Record<string, string>;

    // 更新快取 JSON
    updateCache(uid, characters);

    console.log(`[CardGenerator] Generated ${Object.keys(cardPaths).length} cards for UID ${uid}`);

    return {
      success: true,
      cardPaths,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CardGenerator] Error generating cards:`, error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * 取得角色卡片（含快取機制）
 *
 * 這是對外的主要 API，流程如下：
 * 1. 檢查是否有任何角色需要重新生成
 * 2. 如果需要，批次生成所有角色卡片
 * 3. 回傳指定角色的卡片路徑
 *
 * @param uid - 玩家 UID
 * @param characterId - 要取得的角色 ID
 * @param characters - 所有展櫃角色列表（用於快取比對和更新）
 * @param lang - 語言代碼
 * @param template - 卡片模板樣式
 *
 * Usage:
 * ```typescript
 * const player = await fetchPlayerInfo(uid);
 * const result = await getCharacterCard(uid, "1309", player.characters);
 * if (result.success) {
 *   // 使用 result.filePath 發送圖片
 * }
 * ```
 */
export async function getCharacterCard(
  uid: string,
  characterId: string,
  characters: HsrCharacter[],
  lang: string = "cht",
  template: number = 3
): Promise<CardResult> {
  try {
    // 檢查是否需要重新生成
    if (anyNeedsRegeneration(uid, characters)) {
      console.log(`[CardGenerator] Cache miss for UID ${uid}, regenerating all cards`);

      const genResult = await generateAllCards(uid, characters, lang, template);

      if (!genResult.success) {
        return {
          success: false,
          error: genResult.error,
        };
      }
    } else {
      console.log(`[CardGenerator] Cache hit for UID ${uid}`);
    }

    // 取得角色卡片路徑
    const imagePath = getCardImagePath(uid, characterId);

    // 確認檔案存在
    if (!fs.existsSync(imagePath)) {
      return {
        success: false,
        error: `Card image not found for character ${characterId}`,
      };
    }

    return {
      success: true,
      filePath: imagePath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * 強制重新生成所有卡片（忽略快取）
 *
 * 用於使用者手動要求更新的情況
 *
 * @param uid - 玩家 UID
 * @param characters - 角色列表
 */
export async function forceRegenerateCards(
  uid: string,
  characters: HsrCharacter[],
  lang: string = "cht",
  template: number = 3
): Promise<GenerateAllResult> {
  console.log(`[CardGenerator] Force regenerating cards for UID ${uid}`);
  return generateAllCards(uid, characters, lang, template);
}
