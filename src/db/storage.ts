/**
 * JSON 儲存服務
 *
 * 本地儲存為主，JSONBin.io 為定時備份（若有設定）。
 * 雲端備份採用定時同步（每 6 小時），減少 API 請求次數。
 *
 * 本地與雲端格式統一：
 * {
 *   "hsr": { "discordUserId": "hsrUid", ... },
 *   "zzz": { },
 *   "active": true
 * }
 */

import * as fs from "fs";
import * as path from "path";
import { fetchPlayerInfo } from "../services/hsrService";
import {
  UidData,
  createEmptyUidData,
} from "../services/jsonBinService";

// 資料路徑
const DATA_DIR = path.join(__dirname, "data");

// UID 儲存檔案（本地與雲端格式相同）
const UID_FILE = "uid.json";

// 確保 data 目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 讀取本地 UID 資料
 */
export function loadUidData(): UidData {
  const filePath = path.join(DATA_DIR, UID_FILE);

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(data) as UidData;
      // 確保資料結構正確
      if (parsed.active) {
        return parsed;
      }
    }
  } catch (error) {
    console.error(`[Storage] Failed to load ${UID_FILE}:`, error);
  }

  return createEmptyUidData();
}

/**
 * 儲存本地 UID 資料
 */
export function saveUidData(data: UidData): boolean {
  const filePath = path.join(DATA_DIR, UID_FILE);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to save ${UID_FILE}:`, error);
    return false;
  }
}


// ============================================
// HSR UID 操作
// ============================================

/**
 * 取得用戶的 HSR UID
 */
export function getHsrUid(discordUserId: string): string | null {
  const data = loadUidData();
  return data.hsr[discordUserId] || null;
}

/**
 * 設定 HSR UID（先驗證 UID 是否存在，允許覆蓋舊 UID）
 */
export async function setHsrUid(
  discordUserId: string,
  hsrUid: string
): Promise<{ success: boolean; nickname?: string; error?: string }> {
  // 驗證 UID 是否有效
  const player = await fetchPlayerInfo(hsrUid);

  if (!player) {
    return { success: false, error: "UID 不存在或無法查詢" };
  }

  // 讀取現有資料
  const data = loadUidData();
  data.hsr[discordUserId] = hsrUid;

  if (saveUidData(data)) {
    return { success: true, nickname: player.nickname };
  } else {
    return { success: false, error: "儲存失敗" };
  }
}

/**
 * 刪除 HSR UID
 */
export function deleteHsrUid(discordUserId: string): boolean {
  const data = loadUidData();

  if (!data.hsr[discordUserId]) {
    return false;
  }

  delete data.hsr[discordUserId];
  return saveUidData(data);
}

/**
 * 取得所有 HSR UID 註冊資料
 */
export function getAllHsrUids(): Record<string, string> {
  const data = loadUidData();
  return data.hsr;
}

// ============================================
// 通用 JSON 操作（給其他模組使用）
// ============================================

/**
 * 讀取 JSON 檔案（通用）
 */
export function loadJson<T>(filename: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, filename);

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`[Storage] Failed to load ${filename}:`, error);
  }

  return defaultValue;
}

/**
 * 儲存 JSON 檔案（通用）
 */
export function saveJson<T>(filename: string, data: T): boolean {
  const filePath = path.join(DATA_DIR, filename);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to save ${filename}:`, error);
    return false;
  }
}

// 匯出檔名常數供其他模組使用
export { UID_FILE };
