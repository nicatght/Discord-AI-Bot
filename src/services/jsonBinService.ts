/**
 * JSONBin.io 服務
 *
 * 用於將資料同步到雲端，作為本地 JSON 檔案的備份。
 * 如果未設定 JSONBIN_API_KEY 和 JSONBIN_BIN_ID，則此服務不會執行任何操作。
 *
 * JSONBin.io API 說明：
 * - 讀取 Bin: GET https://api.jsonbin.io/v3/b/{binId}/latest
 * - 更新 Bin: PUT https://api.jsonbin.io/v3/b/{binId}
 * - Header: X-Master-Key 用於驗證
 *
 * 雲端資料結構：
 * {
 *   "hsr": { "discordUserId": "hsrUid", ... },
 *   "zzz": { },  // 未來擴展
 *   "active": true  // 避免空資料
 * }
 */

import { config } from "../config";

const JSONBIN_API_URL = "https://api.jsonbin.io/v3/b";

/**
 * UID 資料結構（本地與雲端統一格式）
 */
export interface UidData {
  hsr: Record<string, string>;  // Discord User ID -> HSR UID
  zzz: Record<string, string>;  // Discord User ID -> ZZZ UID (未來擴展)
  active: true;                 // 避免空資料
}

/**
 * 建立空的 UID 資料結構
 */
export function createEmptyUidData(): UidData {
  return {
    hsr: {},
    zzz: {},
    active: true,
  };
}

/**
 * 檢查 JSONBin 是否已啟用
 */
export function isJsonBinEnabled(): boolean {
  return config.jsonBin.isEnabled;
}

/**
 * 初始化 JSONBin（確保有初始資料）
 *
 * 在啟動時呼叫，如果 Bin 是空的或讀取失敗，寫入初始結構。
 */
export async function initializeJsonBin(): Promise<void> {
  if (!isJsonBinEnabled()) {
    return;
  }

  console.log("[JSONBin] Initializing...");

  const data = await readFromJsonBin<UidData>();

  // 如果讀取失敗或資料為 null，寫入初始結構
  if (data === null || !data.active) {
    console.log("[JSONBin] No valid data found, writing initial structure");
    await writeToJsonBin(createEmptyUidData());
  } else {
    console.log("[JSONBin] Data exists, skipping initialization");
  }
}

/**
 * 從 JSONBin 讀取資料
 *
 * @returns 資料物件，若失敗或未啟用則回傳 null
 */
export async function readFromJsonBin<T>(): Promise<T | null> {
  if (!isJsonBinEnabled()) {
    return null;
  }

  try {
    const response = await fetch(`${JSONBIN_API_URL}/${config.jsonBin.binId}/latest`, {
      method: "GET",
      headers: {
        "X-Master-Key": config.jsonBin.apiKey,
      },
    });

    if (!response.ok) {
      console.error(`[JSONBin] Failed to read: ${response.status} ${response.statusText}`);
      return null;
    }

    const result = (await response.json()) as { record: T; metadata: unknown };

    // JSONBin v3 回傳格式：{ record: {...}, metadata: {...} }
    return result.record;
  } catch (error) {
    console.error("[JSONBin] Error reading data:", error);
    return null;
  }
}

/**
 * 將資料寫入 JSONBin
 *
 * @param data - 要儲存的資料物件
 * @returns 是否成功
 */
export async function writeToJsonBin<T>(data: T): Promise<boolean> {
  if (!isJsonBinEnabled()) {
    return false;
  }

  try {
    const response = await fetch(`${JSONBIN_API_URL}/${config.jsonBin.binId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": config.jsonBin.apiKey,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(`[JSONBin] Failed to write: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log("[JSONBin] Data synced successfully");
    return true;
  } catch (error) {
    console.error("[JSONBin] Error writing data:", error);
    return false;
  }
}

/**
 * 同步本地資料到 JSONBin（非阻塞）
 *
 * 這個函數不會等待 JSONBin 回應，適合用於不需要確認結果的場景。
 * 本地儲存優先，JSONBin 作為備份。
 *
 * @param data - 要同步的資料
 */
export function syncToJsonBin<T>(data: T): void {
  if (!isJsonBinEnabled()) {
    return;
  }

  // 使用 .then().catch() 而非 await，讓主流程不被阻塞
  writeToJsonBin(data)
    .then((success) => {
      if (!success) {
        console.warn("[JSONBin] Sync failed, data only saved locally");
      }
    })
    .catch((error) => {
      console.error("[JSONBin] Sync error:", error);
    });
}
