"""
Honkai Star Rail Character Card Generator

Usage:
    python generate_card.py generate_all <uid> <output_dir> [--lang <lang>] [--template <template>]

Actions:
    generate_all  - Generate cards for ALL showcase characters at once

Arguments:
    uid           - Player UID (e.g., 800123456)
    output_dir    - Output directory for card images (e.g., ../data/hsr/800123456)

Options:
    --lang        - Language code (default: cht)
    --template    - Card template 1-3 (default: 2)

Output:
    Success: Prints "SUCCESS:<json>" where json is {"charId": "filepath", ...}
    Error: Prints "ERROR:<message>" to stdout

Note:
    - Uses Microsoft JhengHei font for proper Chinese character display
    - Generates all showcase characters in one API call (more efficient)
    - Images are saved as <character_id>.png in the output directory
"""

import asyncio
import sys
import os
import argparse
import json
import starrailcard

# Windows 中文字體路徑
# Microsoft JhengHei (微軟正黑體) 支援繁體中文
CHINESE_FONT_PATH = "C:/Windows/Fonts/msjh.ttc"


async def generate_all_cards(uid: str, output_dir: str, lang: str = "cht", template: int = 2):
    """
    Generate cards for ALL showcase characters at once.

    This is more efficient than generating one by one because:
    1. Only one API call to fetch player data
    2. starrailcard generates all cards in one batch
    3. Font only needs to be set once

    Args:
        uid: Player's UID
        output_dir: Directory to save all card images
        lang: Language code (cht = Traditional Chinese)
        template: Card template style (1, 2, or 3)

    Output:
        SUCCESS with JSON mapping: {"1309": "/path/to/1309.png", "1001": "/path/to/1001.png"}
    """
    try:
        # Ensure output directory exists
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        async with starrailcard.Card(lang=lang) as card:
            # Set Chinese font to fix garbled text
            # Must be called before card.create()
            if os.path.exists(CHINESE_FONT_PATH):
                await card.set_user_font(CHINESE_FONT_PATH)

            # Generate cards for all showcase characters
            result = await card.create(uid, style=template)

            if not result or not result.card:
                print("ERROR:No characters found in showcase")
                return False

            # Save each card and build the result mapping
            card_paths = {}

            for c in result.card:
                # Use character ID as filename (avoid Chinese encoding issues)
                char_id = str(c.id)
                filename = f"{char_id}.png"
                file_path = os.path.join(output_dir, filename)

                # Save the card image (c.card is a PIL.Image object)
                c.card.save(file_path, "PNG")

                # Store absolute path in result
                card_paths[char_id] = os.path.abspath(file_path)

            # Output success with JSON mapping
            print(f"SUCCESS:{json.dumps(card_paths)}")
            return True

    except Exception as e:
        print(f"ERROR:{str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate Honkai Star Rail character cards")
    parser.add_argument("action", choices=["generate_all"], help="Action to perform")
    parser.add_argument("uid", help="Player UID")
    parser.add_argument("--output_dir", "-o", required=True, help="Output directory for card images")
    parser.add_argument("--lang", "-l", default="cht", help="Language code (default: cht)")
    parser.add_argument("--template", "-t", type=int, default=2, help="Card template 1-3 (default: 2)")

    args = parser.parse_args()

    if args.action == "generate_all":
        asyncio.run(generate_all_cards(args.uid, args.output_dir, args.lang, args.template))


if __name__ == "__main__":
    main()
