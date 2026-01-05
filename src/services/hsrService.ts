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
  iconUrl: string;
  splashUrl: string;
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
    const userCharacters = user.getCharacters();
    const characters: HsrCharacter[] = userCharacters.map((char) => ({
      name: char.characterData.name.get("cht") || char.characterData.name.get("en") || "Unknown",
      level: char.level,
      rarity: char.characterData.stars,
      element: char.characterData.combatType.name.get("cht") || char.characterData.combatType.name.get("en") || "Unknown",
      lightCone: char.lightCone?.lightConeData.name.get("cht") || char.lightCone?.lightConeData.name.get("en") || null,
      iconUrl: char.characterData.icon.url,
      splashUrl: char.characterData.splashImage.url,
    }));

    return {
      uid: uid,
      nickname: user.nickname,
      level: user.level,
      worldLevel: user.equilibriumLevel,
      profilePictureUrl: user.icon.icon.url,
      signature: user.signature || "",
      characters,
    };
  } catch (error) {
    console.error("[ERROR] Failed to fetch HSR player info:", error);
    return null;
  }
}
