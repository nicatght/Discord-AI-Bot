/**
 * 簡易 JSON 儲存服務
 */

import * as fs from "fs";
import * as path from "path";

// 資料存放在 src/db/data/ 底下
const DATA_DIR = path.join(__dirname, "data");

// 確保 data 目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 讀取 JSON 檔案
 */
export function loadJson<T>(filename: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, filename);

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`[ERROR] Failed to load ${filename}:`, error);
  }

  return defaultValue;
}

/**
 * 儲存 JSON 檔案
 */
export function saveJson<T>(filename: string, data: T): boolean {
  const filePath = path.join(DATA_DIR, filename);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to save ${filename}:`, error);
    return false;
  }
}

/**
 * HSR UID 儲存（Discord User ID -> HSR UID）
 */
const HSR_UID_FILE = "hsr_uids.json";

export function getHsrUid(discordUserId: string): string | null {
  const uids = loadJson<Record<string, string>>(HSR_UID_FILE, {});
  return uids[discordUserId] || null;
}

export function setHsrUid(discordUserId: string, hsrUid: string): boolean {
  const uids = loadJson<Record<string, string>>(HSR_UID_FILE, {});
  uids[discordUserId] = hsrUid;
  return saveJson(HSR_UID_FILE, uids);
}
