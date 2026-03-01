import fs from "fs";
import path from "path";
import os from "os";

const HISTORY_DIR = path.join(os.homedir(), ".libgen-downloader");
const DOWNLOADED_FILE = path.join(HISTORY_DIR, "downloaded.txt");

function ensureHistoryDir(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

/**
 * Load all MD5s that have been successfully downloaded in past sessions.
 */
export function loadDownloadedMD5s(): Set<string> {
  ensureHistoryDir();
  if (!fs.existsSync(DOWNLOADED_FILE)) return new Set();
  try {
    const content = fs.readFileSync(DOWNLOADED_FILE, "utf-8");
    return new Set(
      content
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

/**
 * Append a single MD5 to the downloaded history file immediately after a
 * successful download, so partial runs are recorded even if interrupted later.
 */
export function recordDownloaded(md5: string): void {
  ensureHistoryDir();
  try {
    fs.appendFileSync(DOWNLOADED_FILE, md5.trim() + "\n");
  } catch {
    // non-fatal – worst case the entry is not persisted
  }
}

export { DOWNLOADED_FILE, HISTORY_DIR };
