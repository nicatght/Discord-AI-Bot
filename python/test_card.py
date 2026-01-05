"""
Quick test script for generate_card.py

Usage:
    cd python
    uv run python test_card.py

This script tests:
1. Listing showcase characters for a test UID
2. Generating a card for the first character found
"""

import asyncio
import os
import sys

# Add parent directory to path so we can import generate_card
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generate_card import list_characters, generate_card


async def main():
    # Test UID - you can change this to any valid HSR UID
    # 800xxxxxx = Asia server
    # 600xxxxxx = America server
    # 700xxxxxx = Europe server
    test_uid = input("Enter a HSR UID to test (or press Enter for default 800123456): ").strip()
    if not test_uid:
        test_uid = "800123456"

    print(f"\n[Test 1] Listing characters for UID: {test_uid}")
    print("-" * 50)

    # Test list_characters
    # This will print SUCCESS:<json> or ERROR:<message> to stdout
    await list_characters(test_uid)

    print("\n")
    print(f"[Test 2] Generating card for first character")
    print("-" * 50)

    # For card generation, we need a character ID
    # Common character IDs:
    # 1001 = March 7th
    # 1002 = Dan Heng
    # 1003 = Himeko
    # 1004 = Welt
    # 1005 = Kafka
    # 1006 = Silver Wolf

    char_id = input("Enter character ID (or press Enter for 1001 - March 7th): ").strip()
    if not char_id:
        char_id = "1001"

    # Output path
    output_path = os.path.join(os.path.dirname(__file__), "..", "temp", "test_card.png")

    # Ensure temp directory exists
    temp_dir = os.path.dirname(output_path)
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)

    print(f"Generating card for character {char_id}...")
    print(f"Output path: {output_path}")

    # Test generate_card
    result = await generate_card(
        uid=test_uid,
        character_id=char_id,
        output_path=output_path,
        lang="cht",
        template=2
    )

    if result and os.path.exists(output_path):
        file_size = os.path.getsize(output_path)
        print(f"\nCard generated successfully!")
        print(f"File size: {file_size / 1024:.2f} KB")
        print(f"Open the file to view: {os.path.abspath(output_path)}")
    else:
        print("\nCard generation failed. Check the error message above.")


if __name__ == "__main__":
    print("=" * 50)
    print("StarRailCard Test Script")
    print("=" * 50)

    asyncio.run(main())
