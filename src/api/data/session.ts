import fs from "fs";
import path from "path";
import os from "os";

const SESSION_DIR = path.join(os.homedir(), ".libgen-downloader");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");

export type SessionItemStatus = "in_queue" | "downloaded" | "failed";

export interface SessionItem {
  md5: string;
  title: string;
  filename: string;
  status: SessionItemStatus;
}

export interface Session {
  timestamp: string;
  searchPhrase: string;
  items: SessionItem[];
}

function ensureSessionDir(): void {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

export function saveSession(session: Session): void {
  ensureSessionDir();
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch {
    // non-fatal
  }
}

export function loadSession(): Session | null {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const content = fs.readFileSync(SESSION_FILE, "utf-8");
    return JSON.parse(content) as Session;
  } catch {
    return null;
  }
}
