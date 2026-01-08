/**
 * 崩壞星穹鐵道 API 服務
 * 使用 starrail.js (MiHoMo API) 查詢玩家資料
 *
 * 這個服務負責：
 * 1. 從 MiHoMo API 取得玩家展櫃資料
 * 2. 提供角色詳細資訊用於顯示和快取比對
 */

import { StarRail } from "starrail.js";

// StarRail client - 用於與 MiHoMo API 通訊
const client = new StarRail();

/**
 * 玩家基本資訊
 */
export interface HsrPlayerInfo {
  uid: string;
  nickname: string;
  level: number;
  worldLevel: number;
  profilePictureUrl: string;
  signature: string;
  characters: HsrCharacter[];
}

/**
 * 遺器副詞條資訊
 * 用於快取比對 - 副詞條變化會影響卡片圖片
 */
export interface HsrRelicSubStat {
  statId: string;    // 詞條類型 ID
  value: number;     // 詞條數值
  count: number;     // 強化次數
}

/**
 * 遺器資訊
 * 用於快取比對 - 遺器變化會影響卡片圖片
 */
export interface HsrRelic {
  id: string;        // 遺器 ID
  level: number;     // 遺器等級
  mainStatId: string; // 主詞條類型 ID
  subStats: HsrRelicSubStat[];
}

/**
 * 光錐資訊
 * 用於快取比對 - 光錐變化會影響卡片圖片
 */
export interface HsrLightCone {
  id: string;           // 光錐 ID
  level: number;        // 光錐等級
  superimposition: number; // 疊影等級 (1-5)
}

/**
 * 技能資訊
 * 用於快取比對 - 技能等級變化會影響卡片圖片
 */
export interface HsrSkill {
  id: string;        // 技能 ID
  level: number;     // 技能等級
}

/**
 * 角色完整資訊
 * 包含所有會影響卡片生成的欄位，用於計算 hash 判斷是否需要重新生成
 */
export interface HsrCharacter {
  // 基本資訊 (用於顯示)
  id: string;           // 角色 ID
  name: string;         // 角色名稱
  rarity: number;       // 星級
  element: string;      // 屬性
  iconUrl: string;      // 角色圖示 URL
  splashUrl: string;    // 角色立繪 URL

  // 練度資訊 (用於快取比對)
  level: number;        // 角色等級
  ascension: number;    // 突破等級
  eidolon: number;      // 星魂等級 (0-6)

  // 裝備資訊 (用於快取比對)
  lightCone: HsrLightCone | null;
  relics: HsrRelic[];
  skills: HsrSkill[];
}

/**
 * 用 UID 查詢玩家資料
 *
 * @param uid - 玩家 UID
 * @returns 玩家資訊，包含展櫃角色的完整資料
 *
 * 這個函數會取得角色的所有詳細資訊，包括：
 * - 基本資訊（名稱、等級、星魂）
 * - 光錐（ID、等級、疊影）
 * - 遺器（每件的主副詞條）
 * - 技能等級
 *
 * 這些資訊用於計算 hash，判斷是否需要重新生成角色卡片
 */
export async function fetchPlayerInfo(uid: string): Promise<HsrPlayerInfo | null> {
  try {
    const user = await client.fetchUser(parseInt(uid));

    if (!user) {
      return null;
    }

    // 取得角色資料
    const userCharacters = user.getCharacters();

    const characters: HsrCharacter[] = userCharacters.map((char) => {
      // 解析光錐資訊
      let lightCone: HsrLightCone | null = null;
      if (char.lightCone) {
        lightCone = {
          id: char.lightCone.lightConeData.id.toString(),
          level: char.lightCone.level,
          // superimposition 是一個物件，需要取得其中的 level 屬性
          superimposition: char.lightCone.superimposition?.level ?? 1,
        };
      }

      // 解析遺器資訊
      // relic.mainStat.type 是主詞條類型（如 "HPDelta", "AttackDelta"）
      // relic.subStats[].type 是副詞條類型
      const relics: HsrRelic[] = (char.relics || []).map((relic) => ({
        id: relic.relicData?.id?.toString() || "0",
        level: relic.level,
        mainStatId: relic.mainStat?.type || "unknown",
        subStats: (relic.subStats || []).map((sub) => ({
          statId: sub.type || "unknown",
          value: sub.value || 0,
          count: sub.count || 0,
        })),
      }));

      // 解析技能資訊
      // skill.id 是技能 ID
      // skill.level 是 SkillLevel 物件，有 value 屬性
      const skills: HsrSkill[] = (char.skills || []).map((skill) => ({
        id: skill.id?.toString() || "0",
        level: skill.level?.value ?? 0,
      }));

      // char.eidolons 是數字（0-6），表示已解鎖的星魂數量
      const eidolonCount = typeof char.eidolons === "number" ? char.eidolons : 0;

      return {
        // 基本資訊
        id: char.characterData.id.toString(),
        name: char.characterData.name.get("cht") || char.characterData.name.get("en") || "Unknown",
        rarity: char.characterData.stars,
        element: char.characterData.combatType.name.get("cht") ||
                 char.characterData.combatType.name.get("en") || "Unknown",
        iconUrl: char.characterData.icon.url,
        splashUrl: char.characterData.splashImage.url,

        // 練度資訊
        level: char.level,
        ascension: char.ascension,
        eidolon: eidolonCount,

        // 裝備資訊
        lightCone,
        relics,
        skills,
      };
    });

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
