"""
Honkai Star Rail Character Card Generator

Usage:
    python generate_card.py <uid> <character_id> <output_path> [--lang <lang>] [--template <template>]

Arguments:
    uid           - Player UID (e.g., 800123456)
    character_id  - Character ID (e.g., 1004 for Welt)
    output_path   - Output file path (e.g., ../temp/card_123.png)

Options:
    --lang        - Language code (default: cht)
    --template    - Card template 1-3 (default: 2)

Output:
    Success: Prints "SUCCESS:<filepath>" to stdout
    Error: Prints "ERROR:<message>" to stdout
"""

import asyncio
import sys
import os
import argparse
import starrailcard


async def generate_card(uid: str, character_id: str, output_path: str, lang: str = "cht", template: int = 2):
    """
    Generate a character card for the specified character.

    Args:
        uid: Player's UID
        character_id: The character ID to generate card for
        output_path: Where to save the generated image
        lang: Language code (cht = Traditional Chinese)
        template: Card template style (1, 2, or 3)

    Returns:
        True if successful, False otherwise
    """
    try:
        # Create the card generator
        # lang: cht = Traditional Chinese, en = English, jp = Japanese, etc.
        async with starrailcard.Card(lang=lang) as card:
            # Fetch player data and generate cards for all showcase characters
            # style: Template style (1, 2, 3)
            # Note: New API doesn't support character_id filter, generates all cards
            result = await card.create(
                uid,
                style=template
            )

            # Check if we got any cards
            if not result or not result.card:
                print(f"ERROR:No card generated for character {character_id}")
                return False

            # Find the card for our character from all generated cards
            target_card = None
            for c in result.card:
                if str(c.id) == str(character_id):
                    target_card = c
                    break

            if not target_card:
                print(f"ERROR:Character {character_id} not found in showcase")
                return False

            # Ensure output directory exists
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # Save the card image
            # target_card.card is a PIL.Image object
            target_card.card.save(output_path, "PNG")

            print(f"SUCCESS:{output_path}")
            return True

    except Exception as e:
        print(f"ERROR:{str(e)}")
        return False


async def list_characters(uid: str, lang: str = "cht"):
    """
    List all showcase characters for a player.

    Args:
        uid: Player's UID
        lang: Language code

    Output:
        Prints JSON array of characters: [{"id": "1004", "name": "Welt", "rarity": 5}, ...]
    """
    try:
        import json

        async with starrailcard.Card(lang=lang) as card:
            result = await card.create(uid, style=2)

            if not result or not result.card:
                print("ERROR:No characters found")
                return False

            characters = []
            for c in result.card:
                characters.append({
                    "id": str(c.id),
                    "name": c.name,
                    "rarity": c.rarity
                })

            print(f"SUCCESS:{json.dumps(characters, ensure_ascii=False)}")
            return True

    except Exception as e:
        print(f"ERROR:{str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate Honkai Star Rail character cards")
    parser.add_argument("action", choices=["generate", "list"], help="Action to perform")
    parser.add_argument("uid", help="Player UID")
    parser.add_argument("--character_id", "-c", help="Character ID (required for generate)")
    parser.add_argument("--output", "-o", help="Output file path (required for generate)")
    parser.add_argument("--lang", "-l", default="cht", help="Language code (default: cht)")
    parser.add_argument("--template", "-t", type=int, default=2, help="Card template 1-3 (default: 2)")

    args = parser.parse_args()

    if args.action == "generate":
        if not args.character_id or not args.output:
            print("ERROR:--character_id and --output are required for generate action")
            sys.exit(1)
        asyncio.run(generate_card(args.uid, args.character_id, args.output, args.lang, args.template))

    elif args.action == "list":
        asyncio.run(list_characters(args.uid, args.lang))


if __name__ == "__main__":
    main()
