import fs from "fs";
import path from "path";

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

export interface SessionWithDir {
  session: Session;
  downloadDir: string;
}

export function saveSession(session: Session, downloadDir: string): void {
  try {
    fs.mkdirSync(downloadDir, { recursive: true });
    fs.writeFileSync(path.join(downloadDir, "session.json"), JSON.stringify(session, null, 2));
  } catch {
    // non-fatal
  }
}

export function loadSession(downloadDir: string): Session | null {
  const file = path.join(downloadDir, "session.json");
  if (!fs.existsSync(file)) return null;
  try {
    const content = fs.readFileSync(file, "utf-8");
    return JSON.parse(content) as Session;
  } catch {
    return null;
  }
}

export function findAllSessions(baseDir = "libgen-downloads"): SessionWithDir[] {
  if (!fs.existsSync(baseDir)) return [];

  const results: SessionWithDir[] = [];

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const downloadDir = path.join(baseDir, entry.name);
      const session = loadSession(downloadDir);
      if (session) {
        results.push({ session, downloadDir });
      }
    }
  } catch {
    return [];
  }

  // Sort newest first
  results.sort(
    (a, b) => new Date(b.session.timestamp).getTime() - new Date(a.session.timestamp).getTime()
  );

  return results;
}
