import fs from "fs";
import path from "path";

export function initDownloadedFile(downloadDir: string): string {
  const filepath = path.join(downloadDir, "downloaded.txt");
  fs.mkdirSync(downloadDir, { recursive: true });
  if (!fs.existsSync(filepath)) fs.writeFileSync(filepath, "");
  return filepath;
}

export function initFailedFile(downloadDir: string): string {
  const filepath = path.join(downloadDir, "failed.txt");
  fs.mkdirSync(downloadDir, { recursive: true });
  if (!fs.existsSync(filepath)) fs.writeFileSync(filepath, "");
  return filepath;
}

export function appendMD5ToFile(filepath: string, md5: string): void {
  fs.appendFileSync(filepath, md5 + "\n");
}
