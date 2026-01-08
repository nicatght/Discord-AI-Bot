/**
 * 崩鐵角色卡片快取服務
 *
 * 負責管理角色卡片的快取，包括：
 * 1. 計算角色配置的 hash（用於判斷是否需要重新生成）
 * 2. 讀寫快取 JSON 檔案
 * 3. 管理快取圖片檔案
 *
 * 快取目錄結構：
 * src/db/data/hsr/<uid>/
 *   cache.json    - 快取資訊（hash 對照表）
 *   <charId>.png  - 角色卡片圖片
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { HsrCharacter } from "./service";

// 快取根目錄（與 uid.json 同層）
const CACHE_ROOT = path.join(__dirname, "../../db/data/hsr");

/**
 * 單一角色的快取資訊
 */
interface CharacterCacheInfo {
  hash: string;      // 角色配置的 hash
  name: string;      // 角色名稱（方便查看）
  updatedAt: number; // 更新時間戳
}

/**
 * UID 的快取資訊
 */
interface UidCacheData {
  lastUpdate: number;  // 最後更新時間
  characters: Record<string, CharacterCacheInfo>; // 角色 ID -> 快取資訊
}

/**
 * 計算角色配置的 hash
 *
 * 這個 hash 包含所有會影響卡片生成的欄位：
 * - 角色等級、突破、星魂
 * - 光錐 ID、等級、疊影
 * - 每件遺器的 ID、等級、主副詞條
 * - 技能等級
 *
 * 任何一項改變，hash 就會不同，需要重新生成卡片
 *
 * @param char - 角色完整資訊
 * @returns MD5 hash 字串
 */
export function calculateCharacterHash(char: HsrCharacter): string {
  // 只取會影響卡片的欄位，不包含 iconUrl, splashUrl 等純顯示用的
  const hashData = {
    id: char.id,
    level: char.level,
    ascension: char.ascension,
    eidolon: char.eidolon,
    lightCone: char.lightCone,
    relics: char.relics,
    skills: char.skills,
  };

  // 序列化後計算 MD5 hash
  // 使用 JSON.stringify 確保物件順序一致
  const jsonString = JSON.stringify(hashData, Object.keys(hashData).sort());
  return crypto.createHash("md5").update(jsonString).digest("hex");
}

/**
 * 取得 UID 的快取目錄路徑
 *
 * @param uid - 玩家 UID
 * @returns 目錄路徑
 */
function getCacheDir(uid: string): string {
  return path.join(CACHE_ROOT, uid);
}

/**
 * 取得 cache.json 的路徑
 *
 * @param uid - 玩家 UID
 * @returns 檔案路徑
 */
function getCacheJsonPath(uid: string): string {
  return path.join(getCacheDir(uid), "cache.json");
}

/**
 * 取得角色卡片圖片的路徑
 *
 * @param uid - 玩家 UID
 * @param characterId - 角色 ID
 * @returns 檔案路徑
 */
export function getCardImagePath(uid: string, characterId: string): string {
  return path.join(getCacheDir(uid), `${characterId}.png`);
}

/**
 * 確保快取目錄存在
 *
 * @param uid - 玩家 UID
 */
function ensureCacheDir(uid: string): void {
  const dir = getCacheDir(uid);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 讀取 UID 的快取資訊
 *
 * @param uid - 玩家 UID
 * @returns 快取資訊，如果不存在則回傳 null
 */
export function readCacheData(uid: string): UidCacheData | null {
  const cachePath = getCacheJsonPath(uid);

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(cachePath, "utf-8");
    return JSON.parse(content) as UidCacheData;
  } catch (error) {
    console.error(`[HsrCardCache] Failed to read cache for UID ${uid}:`, error);
    return null;
  }
}

/**
 * 寫入 UID 的快取資訊
 *
 * @param uid - 玩家 UID
 * @param data - 快取資訊
 */
export function writeCacheData(uid: string, data: UidCacheData): void {
  ensureCacheDir(uid);
  const cachePath = getCacheJsonPath(uid);

  try {
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`[HsrCardCache] Failed to write cache for UID ${uid}:`, error);
  }
}

/**
 * 清除 UID 目錄下的所有圖片檔案
 *
 * 當需要重新生成所有卡片時呼叫此函數
 * 會刪除所有 .png 檔案，但保留 cache.json
 *
 * @param uid - 玩家 UID
 */
export function clearCardImages(uid: string): void {
  const dir = getCacheDir(uid);

  if (!fs.existsSync(dir)) {
    return;
  }

  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith(".png")) {
        fs.unlinkSync(path.join(dir, file));
      }
    }
    console.log(`[HsrCardCache] Cleared card images for UID ${uid}`);
  } catch (error) {
    console.error(`[HsrCardCache] Failed to clear images for UID ${uid}:`, error);
  }
}

/**
 * 檢查角色是否需要重新生成卡片
 *
 * @param uid - 玩家 UID
 * @param char - 角色資訊
 * @returns true 如果需要重新生成（hash 不同或圖片不存在）
 */
export function needsRegeneration(uid: string, char: HsrCharacter): boolean {
  const currentHash = calculateCharacterHash(char);
  const cacheData = readCacheData(uid);
  const imagePath = getCardImagePath(uid, char.id);

  // 圖片不存在 -> 需要生成
  if (!fs.existsSync(imagePath)) {
    return true;
  }

  // 快取資訊不存在 -> 需要生成
  if (!cacheData || !cacheData.characters[char.id]) {
    return true;
  }

  // hash 不同 -> 需要重新生成
  return cacheData.characters[char.id].hash !== currentHash;
}

/**
 * 檢查是否有任何角色需要重新生成
 *
 * @param uid - 玩家 UID
 * @param characters - 角色列表
 * @returns true 如果有任何角色需要重新生成
 */
export function anyNeedsRegeneration(uid: string, characters: HsrCharacter[]): boolean {
  return characters.some((char) => needsRegeneration(uid, char));
}

/**
 * 更新快取資訊
 *
 * 在成功生成卡片後呼叫此函數更新 cache.json
 *
 * @param uid - 玩家 UID
 * @param characters - 已生成卡片的角色列表
 */
export function updateCache(uid: string, characters: HsrCharacter[]): void {
  const now = Date.now();

  const cacheData: UidCacheData = {
    lastUpdate: now,
    characters: {},
  };

  for (const char of characters) {
    cacheData.characters[char.id] = {
      hash: calculateCharacterHash(char),
      name: char.name,
      updatedAt: now,
    };
  }

  writeCacheData(uid, cacheData);
}

/**
 * 取得快取目錄路徑（給 Python 用）
 *
 * @param uid - 玩家 UID
 * @returns 目錄路徑
 */
export function getCacheDirectory(uid: string): string {
  ensureCacheDir(uid);
  return getCacheDir(uid);
}
