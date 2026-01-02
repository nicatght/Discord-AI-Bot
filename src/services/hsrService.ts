/**
 * 崩壞星穹鐵道 API 服務
 * 使用 starrail.js (MiHoMo API) 查詢玩家資料
 */

import { StarRail } from "starrail.js";

const client = new StarRail();

export interface HsrPlayerInfo {
  uid: string;
  nickname: string;
  level: number;
  worldLevel: number;
  profilePictureUrl: string;
  signature: string;
  characters: HsrCharacter[];
}

export interface HsrCharacter {
  name: string;
  level: number;
  rarity: number;
  element: string;
  lightCone: string | null;
}

/**
 * 用 UID 查詢玩家資料
 */
export async function fetchPlayerInfo(uid: string): Promise<HsrPlayerInfo | null> {
  try {
    const user = await client.fetchUser(parseInt(uid));

    if (!user) {
      return null;
    }

    // 取得角色資料
    const characters: HsrCharacter[] = user.characters.map((char) => ({
      name: char.name.get("cht") || char.name.get("en") || "Unknown",
      level: char.level,
      rarity: char.rarity,
      element: char.element?.name.get("cht") || char.element?.name.get("en") || "Unknown",
      lightCone: char.lightCone?.name.get("cht") || char.lightCone?.name.get("en") || null,
    }));

    return {
      uid: uid,
      nickname: user.nickname,
      level: user.level,
      worldLevel: user.worldLevel,
      profilePictureUrl: user.profilePictureIcon.imageUrl,
      signature: user.signature || "",
      characters,
    };
  } catch (error) {
    console.error("[ERROR] Failed to fetch HSR player info:", error);
    return null;
  }
}
