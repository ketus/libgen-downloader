import contentDisposition from "content-disposition";
import fs from "fs";
import { DownloadResult } from "../models/DownloadResult";
import { DOWNLOAD_CHUNK_TIMEOUT_MS } from "../../settings";

interface downloadFileArgs {
  downloadStream: Response;
  downloadDir: string;
  signal?: AbortSignal;
  onStart: (filename: string, total: number) => void;
  onData: (filename: string, chunk: Buffer, total: number) => void;
}

export const downloadFile = async ({
  downloadStream,
  downloadDir,
  signal,
  onStart,
  onData,
}: downloadFileArgs): Promise<DownloadResult> => {
  const MAX_FILE_NAME_LENGTH = 128;

  const downloadContentDisposition = downloadStream.headers.get("content-disposition");
  if (!downloadContentDisposition) {
    throw new Error("No content-disposition header found");
  }

  const parsedContentDisposition = contentDisposition.parse(downloadContentDisposition);
  const fullFileName = parsedContentDisposition.parameters.filename;
  const slicedFileName = fullFileName.slice(
    Math.max(fullFileName.length - MAX_FILE_NAME_LENGTH, 0),
    fullFileName.length
  );
  fs.mkdirSync(downloadDir, { recursive: true });
  const path = `${downloadDir}/${slicedFileName}`;

  const total = Number(downloadStream.headers.get("content-length") || 0);
  const filename = parsedContentDisposition.parameters.filename;

  if (!downloadStream.body) {
    throw new Error("No response body");
  }

  onStart(filename, total);

  const file = fs.createWriteStream(path);
  const reader = downloadStream.body.getReader();

  const readChunk = () =>
    new Promise<Awaited<ReturnType<typeof reader.read>>>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new DOMException("Download stalled", "TimeoutError")),
        DOWNLOAD_CHUNK_TIMEOUT_MS
      );
      reader.read().then(
        (result) => { clearTimeout(timeout); resolve(result); },
        (err)    => { clearTimeout(timeout); reject(err); }
      );
    });

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("Download aborted", "AbortError");
      }
      const { done, value } = await readChunk();
      if (done) break;

      const chunk = Buffer.from(value);
      file.write(chunk);
      onData(filename, chunk, total);
    }

    file.end();

    await new Promise<void>((resolve, reject) => {
      file.on("finish", resolve);
      file.on("error", reject);
    });

    const downloadResult: DownloadResult = {
      path,
      filename,
      total,
    };

    return downloadResult;
  } catch (error) {
    file.destroy();
    reader.cancel().catch(() => {});
    const name = (error as Error)?.name;
    if (name === "AbortError" || name === "TimeoutError") throw error;
    throw new Error(`(${filename}) Error occurred while downloading file`);
  }
};
