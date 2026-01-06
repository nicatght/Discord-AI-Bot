/**
 * 定時備份服務
 *
 * 每 6 小時自動將本地 UID 資料備份到 JSONBin.io
 * 減少 API 請求次數，適合 Free Plan 使用
 */

import { loadUidData } from "../db/storage";
import { writeToJsonBin, isJsonBinEnabled } from "./jsonBinService";

// 備份間隔（毫秒）：6 小時
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

// 定時器 ID
let backupTimer: NodeJS.Timeout | null = null;

/**
 * 執行一次雲端備份
 */
export async function backupToCloud(): Promise<boolean> {
  if (!isJsonBinEnabled()) {
    return false;
  }

  console.log("[Backup] Starting scheduled backup...");

  try {
    const data = loadUidData();
    const success = await writeToJsonBin(data);

    if (success) {
      console.log("[Backup] Backup completed successfully");
    } else {
      console.warn("[Backup] Backup failed");
    }

    return success;
  } catch (error) {
    console.error("[Backup] Backup error:", error);
    return false;
  }
}

/**
 * 啟動定時備份
 *
 * 會立即執行一次備份，之後每 6 小時執行一次
 */
export function startScheduledBackup(): void {
  if (!isJsonBinEnabled()) {
    console.log("[Backup] JSONBin not configured, skipping scheduled backup");
    return;
  }

  // 避免重複啟動
  if (backupTimer) {
    console.log("[Backup] Scheduler already running");
    return;
  }

  console.log("[Backup] Starting backup scheduler (every 6 hours)");

  // 設定定時器
  backupTimer = setInterval(() => {
    backupToCloud();
  }, BACKUP_INTERVAL_MS);

  // 計算下次備份時間
  const nextBackup = new Date(Date.now() + BACKUP_INTERVAL_MS);
  console.log(`[Backup] Next backup at: ${nextBackup.toLocaleString("zh-TW")}`);
}

/**
 * 停止定時備份
 */
export function stopScheduledBackup(): void {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
    console.log("[Backup] Scheduler stopped");
  }
}

/**
 * 取得備份間隔（小時）
 */
export function getBackupIntervalHours(): number {
  return BACKUP_INTERVAL_MS / (60 * 60 * 1000);
}
