/**
 * ZZZ (Zenless Zone Zero) Service
 *
 * 負責呼叫 Python 腳本取得絕區零玩家資料。
 * 使用 enka-py 從 Enka.Network API 獲取玩家展示櫃資訊。
 *
 * 運作流程：
 * 1. 透過 UID 呼叫 Python 腳本
 * 2. Python 腳本使用 enka-py 從 Enka.Network 取得資料
 * 3. 解析 JSON 回傳結果
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Python 相關路徑
// pyproject.toml 和 .venv 在專案根目錄
const PROJECT_ROOT = path.join(__dirname, "../../..");
const PYTHON_SCRIPT = path.join(__dirname, "fetch_profile.py");

// 判斷作業系統
const isWindows = process.platform === "win32";

// 虛擬環境的 Python 執行檔路徑
const UV_VENV_PYTHON = isWindows
  ? path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe")
  : path.join(PROJECT_ROOT, ".venv", "bin", "python");
const VENV_PYTHON = isWindows
  ? path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe")
  : path.join(PROJECT_ROOT, "venv", "bin", "python");
const PYTHON_EXECUTABLE = fs.existsSync(UV_VENV_PYTHON)
  ? UV_VENV_PYTHON
  : fs.existsSync(VENV_PYTHON)
    ? VENV_PYTHON
    : "python";

/**
 * ZZZ 角色資料介面
 */
export interface ZzzCharacter {
  id: string;
  name: string;
  level: number;
  rank: number; // Mindscape Cinema rank (like constellation)
  rarity: number;
  element: string | null;
  specialty: string | null;
  stats?: Record<string, number>;
  w_engine?: {
    id: string;
    name: string;
    level: number;
    rank: number;
    rarity: number;
  };
  icon?: string;
}

/**
 * ZZZ 玩家資料介面
 */
export interface ZzzPlayer {
  uid: string;
  nickname: string;
  level: number;
  signature?: string;
  avatar_url?: string;
}

/**
 * ZZZ 展示櫃資料介面
 */
export interface ZzzShowcase {
  player: ZzzPlayer;
  characters: ZzzCharacter[];
  ttl: number; // 快取剩餘時間（秒）
}

/**
 * 取得玩家資料的結果
 */
export interface FetchResult {
  success: boolean;
  data?: ZzzShowcase;
  error?: string;
}

/**
 * 執行 Python 腳本並取得輸出
 */
function runPython(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[ZZZ Service] Using Python: ${PYTHON_EXECUTABLE}`);
    console.log(`[ZZZ Service] Script: ${PYTHON_SCRIPT}`);
    console.log(`[ZZZ Service] Args: ${args.join(" ")}`);

    const process = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT, ...args]);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code !== 0) {
        console.error(`[ZZZ Service] Python stderr: ${stderr}`);
        reject(new Error(`Python process exited with code ${code}`));
        return;
      }

      resolve(stdout.trim());
    });

    process.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

/**
 * 解析 Python 腳本輸出
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
 * 取得玩家展示櫃資料
 *
 * @param uid - 玩家 UID
 * @param lang - 語言代碼（預設：cht 繁體中文）
 * @returns 玩家展示櫃資料
 *
 * 使用範例：
 * ```typescript
 * const result = await fetchPlayerShowcase("1300012345");
 * if (result.success && result.data) {
 *   console.log(result.data.player.nickname);
 *   console.log(result.data.characters);
 * }
 * ```
 */
export async function fetchPlayerShowcase(
  uid: string,
  lang: string = "cht"
): Promise<FetchResult> {
  try {
    const output = await runPython(["fetch", uid, "--lang", lang]);
    const result = parseOutput(output);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Unknown error",
      };
    }

    // 解析 JSON
    const showcase = JSON.parse(result.data) as ZzzShowcase;

    console.log(
      `[ZZZ Service] Fetched player ${showcase.player.nickname} with ${showcase.characters.length} characters`
    );

    return {
      success: true,
      data: showcase,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ZZZ Service] Error:`, error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * 檢查 Python 環境是否可用
 */
export function isPythonAvailable(): boolean {
  return fs.existsSync(PYTHON_EXECUTABLE) || PYTHON_EXECUTABLE === "python";
}

/**
 * 取得元素對應的顏色
 */
export function getElementColor(element: string | null): number {
  const colors: Record<string, number> = {
    FIRE: 0xff6b35, // 火 - 橙紅色
    ICE: 0x00bfff, // 冰 - 天藍色
    ELECTRIC: 0xffff00, // 電 - 黃色
    ETHER: 0xff69b4, // 以太 - 粉色
    PHYSICAL: 0xc0c0c0, // 物理 - 銀色
  };

  return element ? colors[element] || 0x808080 : 0x808080;
}
