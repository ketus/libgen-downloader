import fs from "fs";

export function initMD5ListFile(): string {
  const filename = `libgen_downloader_md5_list_${Date.now()}.txt`;
  fs.writeFileSync(filename, "");
  return filename;
}

export function appendMD5ToFile(filename: string, md5: string): void {
  fs.appendFileSync(filename, md5 + "\n");
}
