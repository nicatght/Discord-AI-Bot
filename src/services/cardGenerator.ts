/**
 * Card Generator Service
 *
 * This service calls the Python script to generate Honkai Star Rail character cards.
 * It uses the starrailcard Python library which fetches data from MiHoMo API
 * and generates beautiful character cards with stats, relics, and light cones.
 *
 * How it works:
 * 1. Node.js spawns a Python child process
 * 2. Python script uses starrailcard to generate the card image
 * 3. Image is saved to temp/ directory
 * 4. Node.js reads the file path from Python's stdout
 * 5. The image file can then be sent to Discord
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Python 相關路徑
const PYTHON_DIR = path.join(__dirname, "../../python");
const PYTHON_SCRIPT = path.join(PYTHON_DIR, "generate_card.py");

// 虛擬環境的 Python 執行檔路徑（Windows）
// uv 使用 .venv 目錄，傳統 venv 使用 venv 目錄
// 優先順序：.venv (uv) -> venv (傳統) -> 系統 python
const UV_VENV_PYTHON = path.join(PYTHON_DIR, ".venv", "Scripts", "python.exe");
const VENV_PYTHON = path.join(PYTHON_DIR, "venv", "Scripts", "python.exe");
const PYTHON_EXECUTABLE = fs.existsSync(UV_VENV_PYTHON)
  ? UV_VENV_PYTHON
  : fs.existsSync(VENV_PYTHON)
    ? VENV_PYTHON
    : "python";

// Temp directory for generated images
const TEMP_DIR = path.join(__dirname, "../../temp");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Character info from the Python script
 */
export interface CharacterInfo {
  id: string;
  name: string;
  rarity: number;
}

/**
 * Result from card generation
 */
export interface CardResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Run the Python script and capture its output.
 *
 * @param args - Arguments to pass to the Python script
 * @returns Promise that resolves with stdout content
 *
 * How child_process.spawn works:
 * - spawn() creates a new process running the specified command
 * - We listen to 'stdout' for normal output
 * - We listen to 'stderr' for error output
 * - 'close' event fires when the process exits
 */
function runPython(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // spawn(command, args) - 執行指定的命令
    // 使用 PYTHON_EXECUTABLE，如果有 venv 就用 venv 的 Python
    console.log(`[CardGenerator] Using Python: ${PYTHON_EXECUTABLE}`);
    const process = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT, ...args]);

    let stdout = "";
    let stderr = "";

    // Collect stdout data
    // 'data' event fires when the process writes to stdout
    process.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    // Collect stderr data (for debugging)
    process.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // 'close' event fires when the process exits
    // code is the exit code (0 = success, non-zero = error)
    process.on("close", (code) => {
      if (code !== 0) {
        console.error(`[CardGenerator] Python stderr: ${stderr}`);
        reject(new Error(`Python process exited with code ${code}`));
        return;
      }

      // Return the stdout content (trimmed of whitespace)
      resolve(stdout.trim());
    });

    // Handle process errors (e.g., Python not installed)
    process.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

/**
 * Parse the Python script output.
 *
 * The Python script outputs in format:
 * - Success: "SUCCESS:<data>"
 * - Error: "ERROR:<message>"
 *
 * @param output - Raw output from Python script
 * @returns Parsed result with success status and data/error
 */
function parseOutput(output: string): { success: boolean; data?: string; error?: string } {
  if (output.startsWith("SUCCESS:")) {
    return {
      success: true,
      data: output.substring(8), // Remove "SUCCESS:" prefix
    };
  } else if (output.startsWith("ERROR:")) {
    return {
      success: false,
      error: output.substring(6), // Remove "ERROR:" prefix
    };
  } else {
    return {
      success: false,
      error: `Unexpected output: ${output}`,
    };
  }
}

/**
 * Generate a unique filename for the card image.
 *
 * Uses timestamp and random string to avoid collisions.
 * Example: "card_1704067200000_abc123.png"
 */
function generateFileName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `card_${timestamp}_${random}.png`;
}

/**
 * List all showcase characters for a player.
 *
 * @param uid - Player's UID
 * @param lang - Language code (default: "cht" for Traditional Chinese)
 * @returns Array of character info
 *
 * Usage:
 * ```typescript
 * const characters = await listCharacters("800123456");
 * // Returns: [{ id: "1004", name: "Welt", rarity: 5 }, ...]
 * ```
 */
export async function listCharacters(uid: string, lang: string = "cht"): Promise<CharacterInfo[]> {
  try {
    const output = await runPython(["list", uid, "--lang", lang]);
    const result = parseOutput(output);

    if (!result.success || !result.data) {
      console.error(`[CardGenerator] Failed to list characters: ${result.error}`);
      return [];
    }

    // Parse JSON array from the data
    return JSON.parse(result.data) as CharacterInfo[];
  } catch (error) {
    console.error(`[CardGenerator] Error listing characters:`, error);
    return [];
  }
}

/**
 * Generate a character card image.
 *
 * @param uid - Player's UID
 * @param characterId - Character ID to generate card for
 * @param lang - Language code (default: "cht")
 * @param template - Card template style 1-3 (default: 2)
 * @returns Result with file path on success
 *
 * Usage:
 * ```typescript
 * const result = await generateCard("800123456", "1004");
 * if (result.success) {
 *   // Use result.filePath to send the image
 *   await channel.send({ files: [result.filePath] });
 *   // Clean up after sending
 *   deleteCardFile(result.filePath);
 * }
 * ```
 */
export async function generateCard(
  uid: string,
  characterId: string,
  lang: string = "cht",
  template: number = 2
): Promise<CardResult> {
  try {
    // Generate output file path
    const fileName = generateFileName();
    const outputPath = path.join(TEMP_DIR, fileName);

    // Run Python script
    const output = await runPython([
      "generate",
      uid,
      "--character_id",
      characterId,
      "--output",
      outputPath,
      "--lang",
      lang,
      "--template",
      template.toString(),
    ]);

    const result = parseOutput(output);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    // Verify file was created
    if (!fs.existsSync(outputPath)) {
      return {
        success: false,
        error: "Card file was not created",
      };
    }

    return {
      success: true,
      filePath: outputPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Delete a card file after it's been used.
 *
 * Call this after sending the image to Discord to clean up disk space.
 *
 * @param filePath - Path to the file to delete
 */
export function deleteCardFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`[CardGenerator] Failed to delete file: ${filePath}`, error);
  }
}

/**
 * Clean up old card files in the temp directory.
 *
 * Deletes files older than the specified age.
 *
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 */
export function cleanupOldCards(maxAgeMs: number = 60 * 60 * 1000): void {
  try {
    const now = Date.now();
    const files = fs.readdirSync(TEMP_DIR);

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);

      // Check if file is older than maxAge
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        console.log(`[CardGenerator] Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error(`[CardGenerator] Error during cleanup:`, error);
  }
}
