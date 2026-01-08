"""
Zenless Zone Zero Player Profile Fetcher

Usage:
    python fetch_profile.py fetch <uid>
    python fetch_profile.py fetch <uid> --lang <lang>

Actions:
    fetch  - Fetch player profile and showcase characters

Arguments:
    uid    - Player UID (e.g., 1300012345)

Options:
    --lang - Language code (default: cht)
             Supported: en, zh-CN, zh-TW, ja, ko, etc.

Output:
    Success: Prints "SUCCESS:<json>" where json contains player and character data
    Error: Prints "ERROR:<message>" to stdout

Note:
    - Uses Enka.Network API to fetch player showcase data
    - Only characters in the player's showcase will be returned
    - The API has rate limiting, check ttl field for cache timeout
"""

import asyncio
import sys
import argparse
import json
import io
from typing import Any

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Disable enka-py debug logging before importing
from loguru import logger
logger.disable("enka")

import enka


# Language mapping for ZZZ
LANG_MAP = {
    "en": enka.zzz.Language.ENGLISH,
    "cht": enka.zzz.Language.TRADITIONAL_CHINESE,
    "chs": enka.zzz.Language.SIMPLIFIED_CHINESE,
    "zh-TW": enka.zzz.Language.TRADITIONAL_CHINESE,
    "zh-CN": enka.zzz.Language.SIMPLIFIED_CHINESE,
    "ja": enka.zzz.Language.JAPANESE,
    "ko": enka.zzz.Language.KOREAN,
}


def get_language(lang_code: str) -> enka.zzz.Language:
    """Get the language enum from language code."""
    return LANG_MAP.get(lang_code, enka.zzz.Language.TRADITIONAL_CHINESE)


def serialize_character(char: Any) -> dict:
    """Serialize a character (Agent) object to a dictionary."""
    try:
        # Get element from elements list (ZZZ agents can have multiple elements)
        element = None
        if hasattr(char, "elements") and char.elements:
            element = char.elements[0].name if char.elements else None

        # Get specialty
        specialty = None
        if hasattr(char, "specialty") and char.specialty:
            specialty = char.specialty.name if hasattr(char.specialty, "name") else str(char.specialty)

        # Build character data
        char_data = {
            "id": str(char.id),
            "name": char.name,
            "level": char.level,
            "rank": char.mindscape if hasattr(char, "mindscape") else 0,  # Mindscape Cinema rank
            "rarity": char.rarity if hasattr(char, "rarity") else char.rarity_num,
            "element": element,
            "specialty": specialty,
        }

        # Add stats if available
        if hasattr(char, "stats") and char.stats:
            stats = {}
            for stat in char.stats:
                if hasattr(stat, "type") and hasattr(stat, "value"):
                    stat_name = stat.type.name if hasattr(stat.type, "name") else str(stat.type)
                    stats[stat_name] = stat.value
            char_data["stats"] = stats

        # Add W-Engine (weapon) if available
        if hasattr(char, "w_engine") and char.w_engine:
            engine = char.w_engine
            # Check for refinement level in different possible attribute names
            refinement = 1
            if hasattr(engine, "rank"):
                refinement = engine.rank
            elif hasattr(engine, "refinement"):
                refinement = engine.refinement

            char_data["w_engine"] = {
                "id": str(engine.id),
                "name": engine.name,
                "level": engine.level,
                "rank": refinement,
                "rarity": engine.rarity if hasattr(engine, "rarity") else 4,
            }

        # Add icon URL if available
        if hasattr(char, "icon") and char.icon:
            char_data["icon"] = str(char.icon)

        return char_data

    except Exception as e:
        # Return minimal data on error
        return {
            "id": str(getattr(char, "id", "unknown")),
            "name": getattr(char, "name", "Unknown"),
            "error": str(e),
        }


async def fetch_profile(uid: str, lang: str = "cht") -> None:
    """
    Fetch player profile and showcase characters from Enka.Network.

    Args:
        uid: Player's UID
        lang: Language code (default: cht for Traditional Chinese)

    Output:
        Prints SUCCESS with JSON data or ERROR with message
    """
    try:
        language = get_language(lang)

        async with enka.ZZZClient(language) as client:
            response = await client.fetch_showcase(int(uid))

            # Build player data
            player_data = {
                "uid": uid,
                "nickname": response.player.nickname if response.player else "Unknown",
                "level": response.player.level if response.player else 0,
            }

            # Add profile details if available
            if response.player:
                player = response.player
                if hasattr(player, "signature") and player.signature:
                    player_data["signature"] = player.signature
                # Get avatar icon URL (avatar is a string URL directly)
                if hasattr(player, "avatar") and player.avatar:
                    player_data["avatar_url"] = str(player.avatar)

            # Build characters list (agents in ZZZ)
            characters = []
            if response.agents:
                for agent in response.agents:
                    characters.append(serialize_character(agent))

            # Build final result
            result = {
                "player": player_data,
                "characters": characters,
                "ttl": response.ttl if hasattr(response, "ttl") else 0,
            }

            print(f"SUCCESS:{json.dumps(result, ensure_ascii=False)}")

    except enka.errors.PlayerDoesNotExistError:
        print(f"ERROR:Player with UID {uid} does not exist")
    except enka.errors.GameMaintenanceError:
        print("ERROR:Game is under maintenance, please try again later")
    except Exception as e:
        print(f"ERROR:{str(e)}")


def main():
    parser = argparse.ArgumentParser(description="Fetch Zenless Zone Zero player profile")
    parser.add_argument("action", choices=["fetch"], help="Action to perform")
    parser.add_argument("uid", help="Player UID")
    parser.add_argument("--lang", "-l", default="cht", help="Language code (default: cht)")

    args = parser.parse_args()

    if args.action == "fetch":
        asyncio.run(fetch_profile(args.uid, args.lang))


if __name__ == "__main__":
    main()
