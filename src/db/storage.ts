/**
 * JSON 儲存服務
 */

import * as fs from "fs";
import * as path from "path";
import { fetchPlayerInfo } from "../services/hsrService";

// 資料路徑
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

/**
 * 設定 HSR UID（先驗證 UID 是否存在）
 * @returns { success: true, nickname } 儲存成功，{ success: false, error } 失敗
 */
export async function setHsrUid(
  discordUserId: string,
  hsrUid: string
): Promise<{ success: boolean; nickname?: string; error?: string }> {
  // 先檢查是否已經綁定過
  const existingUids = loadJson<Record<string, string>>(HSR_UID_FILE, {});
  if (existingUids[discordUserId]) {
    return { success: false, error: "你已經綁定過 UID 了，請先使用 `/honkai-star-rail uid delete` 刪除舊的 UID" };
  }

  // 驗證 UID 是否有效
  const player = await fetchPlayerInfo(hsrUid);

  if (!player) {
    return { success: false, error: "UID 不存在或無法查詢" };
  }

  // 儲存 uid
  const uids = loadJson<Record<string, string>>(HSR_UID_FILE, {});
  uids[discordUserId] = hsrUid;

  if (saveJson(HSR_UID_FILE, uids)) {
    return { success: true, nickname: player.nickname };
  } else {
    return { success: false, error: "儲存失敗" };
  }
}

/**
 * 刪除 HSR UID
 * @returns true 刪除成功，false 沒有資料可刪除
 */
export function deleteHsrUid(discordUserId: string): boolean {
  const uids = loadJson<Record<string, string>>(HSR_UID_FILE, {});

  if (!uids[discordUserId]) {
    return false;
  }

  delete uids[discordUserId];
  return saveJson(HSR_UID_FILE, uids);
}
