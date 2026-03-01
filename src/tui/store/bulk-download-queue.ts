import path from "path";
import fs from "fs";
import { TCombinedStore } from "./index";
import { Entry } from "../../api/models/Entry";
import { DownloadStatus } from "../../download-statuses";
import { attempt } from "../../utils";
import { sanitizeFolderName } from "../../utils";
import { LAYOUT_KEY } from "../layouts/keys";
import { IDownloadProgress } from "./download-queue";
import { getDocument } from "../../api/data/document";
import { downloadFile } from "../../api/data/download";
import { getAdapter } from "../../api/adapters";
import { Adapter } from "../../api/adapters/Adapter";
import { initDownloadedFile, initFailedFile, appendMD5ToFile, appendFailedEntry } from "../../api/data/file";
import { loadDownloadedMD5s, recordDownloaded } from "../../api/data/downloadHistory";
import { saveSession, loadSession, Session, SessionItem } from "../../api/data/session";
import { REQUEST_TIMEOUT_MS, BULK_DOWNLOAD_CONCURRENCY } from "../../settings";
import objectHash from "object-hash";

const BASE_DOWNLOAD_DIR = "libgen-downloads";

export interface IBulkDownloadQueueItem extends IDownloadProgress {
  md5: string;
}

export interface IBulkDownloadQueueState {
  isBulkDownloadComplete: boolean;
  isResumedSession: boolean;

  completedBulkDownloadItemCount: number;
  skippedBulkDownloadItemCount: number;
  failedBulkDownloadItemCount: number;

  downloadDir: string;

  bulkDownloadSelectedEntries: Record<string, Entry>;
  bulkDownloadQueue: IBulkDownloadQueueItem[];

  addToBulkDownloadQueue: (entry: Entry) => void;
  removeFromBulkDownloadQueue: (entry: Entry) => void;
  onBulkQueueItemProcessing: (index: number) => void;
  onBulkQueueItemStart: (index: number, filename: string, total: number) => void;
  onBulkQueueItemData: (index: number, filename: string, chunk: Buffer, total: number) => void;
  onBulkQueueItemComplete: (index: number) => void;
  onBulkQueueItemFail: (index: number) => void;
  onBulkQueueItemSkip: (index: number) => void;
  onBulkQueueItemUserSkip: (index: number) => void;
  skipCurrentBulkItem: () => void;
  operateBulkDownloadQueue: () => Promise<void>;
  startBulkDownload: () => Promise<void>;
  startBulkDownloadInCLI: (md5List: string[], folderName: string) => Promise<void>;
  resumeFromSession: (session: Session, downloadDir: string) => void;
  resetBulkDownloadQueue: () => void;
}

export const initialBulkDownloadQueueState = {
  isBulkDownloadComplete: false,
  isResumedSession: false,

  completedBulkDownloadItemCount: 0,
  skippedBulkDownloadItemCount: 0,
  failedBulkDownloadItemCount: 0,

  downloadDir: "",

  bulkDownloadSelectedEntries: {},
  bulkDownloadQueue: [],
};

export const createBulkDownloadQueueStateSlice = (
  set: (partial: Partial<TCombinedStore> | ((state: TCombinedStore) => Partial<TCombinedStore>)) => void,
  get: () => TCombinedStore
) => {
  // Tracks AbortControllers for all currently active download items.
  const activeControllers = new Map<number, AbortController>();

  // Persists the current bulk selection to a session file immediately, so the
  // folder and session are visible even if the user exits before starting the download.
  const persistQueueToSession = () => {
    const searchValue = get().searchValue;
    if (!searchValue) return;

    const entries = Object.values(get().bulkDownloadSelectedEntries);
    const mirrorAdapter = get().mirrorAdapter;

    if (entries.length === 0 || !mirrorAdapter) return;

    const downloadDir = path.join(BASE_DOWNLOAD_DIR, sanitizeFolderName(searchValue));

    const sessionItems: SessionItem[] = [];
    for (const entry of entries) {
      try {
        const pageURL = mirrorAdapter.getPageURL(entry.mirror);
        if (!pageURL) continue;
        const md5 = new URL(pageURL).searchParams.get("md5");
        if (md5) sessionItems.push({ md5, title: entry.title, filename: "", status: "in_queue" });
      } catch {
        continue;
      }
    }

    if (sessionItems.length === 0) return;

    try {
      initDownloadedFile(downloadDir);
      initFailedFile(downloadDir);
    } catch {
      // non-fatal
    }

    saveSession(
      { timestamp: new Date().toISOString(), searchPhrase: searchValue, items: sessionItems },
      downloadDir
    );
  };

  return {
  ...initialBulkDownloadQueueState,

  addToBulkDownloadQueue: (entry: Entry) => {
    const store = get();

    const entryHash = objectHash(entry);
    if (store.bulkDownloadSelectedEntries[entryHash]) {
      store.setWarningMessage(`Entry with ID ${entry.id} is already in the bulk download queue`);
      return;
    }

    const newEntryMap = { ...store.bulkDownloadSelectedEntries, [entryHash]: entry };

    set({
      bulkDownloadSelectedEntries: newEntryMap,
    });

    persistQueueToSession();
  },

  removeFromBulkDownloadQueue: (entry: Entry) => {
    const store = get();

    const entryHash = objectHash(entry);

    if (!store.bulkDownloadSelectedEntries[entryHash]) {
      store.setWarningMessage(`Entry with ID ${entry.id} is not in the bulk download queue`);
      return;
    }

    const newEntryMap = Object.entries(store.bulkDownloadSelectedEntries).reduce<
      Record<string, Entry>
    >((acc, [hash, item]) => {
      if (hash !== entryHash) {
        acc[hash] = item;
      }
      return acc;
    }, {});

    set({
      bulkDownloadSelectedEntries: newEntryMap,
    });

    persistQueueToSession();
  },

  onBulkQueueItemProcessing: (index: number) => {
    set((prev) => ({
      bulkDownloadQueue: prev.bulkDownloadQueue.map((item, i) => {
        if (index !== i) {
          return item;
        }

        return {
          ...item,
          status: DownloadStatus.PROCESSING,
        };
      }),
    }));
  },

  onBulkQueueItemStart: (index: number, filename: string, total: number) => {
    set((prev) => ({
      bulkDownloadQueue: prev.bulkDownloadQueue.map((item, i) => {
        if (index !== i) {
          return item;
        }

        return {
          ...item,
          filename,
          total,
          progress: 0,
          status: DownloadStatus.DOWNLOADING,
        };
      }),
    }));
  },

  onBulkQueueItemData: (index: number, filename: string, chunk: Buffer, total: number) => {
    set((prev) => ({
      bulkDownloadQueue: prev.bulkDownloadQueue.map((item, i) => {
        if (index !== i) {
          return item;
        }

        return {
          ...item,
          filename,
          total,
          progress: (item.progress || 0) + chunk.length,
        };
      }),
    }));
  },

  onBulkQueueItemComplete: (index: number) => {
    const md5 = get().bulkDownloadQueue[index]?.md5;

    set((prev) => ({
      bulkDownloadQueue: prev.bulkDownloadQueue.map((item, i) => {
        if (index !== i) {
          return item;
        }

        return {
          ...item,
          status: DownloadStatus.DOWNLOADED,
        };
      }),
    }));

    set((prev) => ({
      completedBulkDownloadItemCount: prev.completedBulkDownloadItemCount + 1,
    }));

    // Persist to history immediately so interruptions don't lose progress
    if (md5) {
      recordDownloaded(md5);
    }
  },

  onBulkQueueItemFail: (index: number) => {
    set((prev) => ({
      bulkDownloadQueue: prev.bulkDownloadQueue.map((item, i) => {
        if (index !== i) {
          return item;
        }

        return {
          ...item,
          status: DownloadStatus.FAILED,
        };
      }),
    }));

    set((prev) => ({
      failedBulkDownloadItemCount: prev.failedBulkDownloadItemCount + 1,
    }));
  },

  onBulkQueueItemSkip: (index: number) => {
    set((prev) => ({
      bulkDownloadQueue: prev.bulkDownloadQueue.map((item, i) => {
        if (index !== i) {
          return item;
        }

        return {
          ...item,
          status: DownloadStatus.ALREADY_DOWNLOADED,
        };
      }),
    }));

    set((prev) => ({
      skippedBulkDownloadItemCount: prev.skippedBulkDownloadItemCount + 1,
    }));
  },

  onBulkQueueItemUserSkip: (index: number) => {
    set((prev) => ({
      bulkDownloadQueue: prev.bulkDownloadQueue.map((item, i) => {
        if (index !== i) return item;
        return { ...item, status: DownloadStatus.SKIPPED };
      }),
    }));
  },

  skipCurrentBulkItem: () => {
    activeControllers.forEach((c) => c.abort());
  },

  operateBulkDownloadQueue: async () => {
    const bulkDownloadQueue = get().bulkDownloadQueue;
    const downloadDir = get().downloadDir;

    const downloadedFilePath = path.join(downloadDir, "downloaded.txt");
    const failedFilePath = path.join(downloadDir, "failed.jsonl");

    // Load session so we can update it incrementally during the run
    const session = loadSession(downloadDir);

    // Load history of already-downloaded MD5s once before the loop
    const downloadedMD5s = loadDownloadedMD5s();

    // Update a session item's status and persist immediately
    const updateSession = (md5: string, status: SessionItem["status"], filename?: string) => {
      if (!session) return;
      const item = session.items.find((s) => s.md5 === md5);
      if (item) {
        item.status = status;
        if (filename !== undefined) item.filename = filename;
        saveSession(session, downloadDir);
      }
    };

    const appendToFailedFile = (md5: string, reason: string) => {
      try {
        appendFailedEntry(failedFilePath, md5, reason);
      } catch {
        // non-fatal
      }
    };

    const processItem = async (i: number, item: IBulkDownloadQueueItem) => {
      if (downloadedMD5s.has(item.md5.toLowerCase())) {
        get().onBulkQueueItemSkip(i);
        return;
      }

      get().onBulkQueueItemProcessing(i);

      const controller = new AbortController();
      activeControllers.set(i, controller);
      const { signal } = controller;

      // Build ordered list of adapters: primary mirror first, then the remaining mirrors as fallbacks.
      const primaryAdapter = get().mirrorAdapter;
      const mirrors = get().mirrors;
      const adapters: Adapter[] = primaryAdapter ? [primaryAdapter] : [];
      for (const m of mirrors) {
        if (primaryAdapter && m.src === primaryAdapter.baseURL) continue;
        try { adapters.push(getAdapter(m.src, m.type)); } catch { /* skip unknown type */ }
      }

      let lastError = "Download failed";
      let succeeded = false;

      try {
        for (const adapter of adapters) {
          if (signal.aborted) break;

          // Track whether onStart was called so we know if a failure happened mid-stream.
          // Mid-stream failures don't retry other mirrors to avoid leaving partial corrupt files.
          let downloadStarted = false;
          try {
            const detailPageUrl = adapter.getDetailPageURL(item.md5);
            const detailPageDocument = await attempt(() => getDocument(detailPageUrl, signal));
            if (!detailPageDocument) {
              lastError = "Couldn't fetch detail page";
              continue;
            }

            const downloadUrl = adapter.getMainDownloadURLFromDocument(detailPageDocument);
            if (!downloadUrl) {
              lastError = "Couldn't find download URL in detail page";
              continue;
            }

            const downloadSignal = AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
            const downloadStream = await attempt(() => fetch(downloadUrl, { signal: downloadSignal }));
            if (!downloadStream) {
              lastError = "Couldn't fetch download stream";
              continue;
            }

            let downloadedFilename = "";
            await downloadFile({
              downloadStream,
              downloadDir,
              signal,
              onStart: (filename, total) => {
                downloadStarted = true;
                downloadedFilename = filename;
                get().onBulkQueueItemStart(i, filename, total);
              },
              onData: (filename, chunk, total) => {
                get().onBulkQueueItemData(i, filename, chunk, total);
              },
            });

            get().onBulkQueueItemComplete(i);
            updateSession(item.md5, "downloaded", downloadedFilename);
            try { appendMD5ToFile(downloadedFilePath, item.md5); } catch { /* non-fatal */ }
            succeeded = true;
            break;
          } catch (err) {
            const name = (err as Error)?.name;
            if (name === "AbortError") throw err; // propagate to outer catch for user-skip handling
            lastError = err instanceof Error ? err.message : "Download failed";
            if (downloadStarted && name !== "TimeoutError") break; // non-timeout mid-stream failure: don't try other mirrors
            // pre-stream failure or timeout: try next mirror (timeout may be mirror-specific)
          }
        }

        if (!succeeded) {
          get().onBulkQueueItemFail(i);
          appendToFailedFile(item.md5, lastError);
          updateSession(item.md5, "failed");
        }
      } catch (err) {
        // Only AbortError reaches here (user pressed S to skip)
        get().onBulkQueueItemUserSkip(i);
      } finally {
        activeControllers.delete(i);
      }
    };

    // Worker pool: BULK_DOWNLOAD_CONCURRENCY workers pull from a shared index counter.
    // Safe in single-threaded JS since the index read+increment is synchronous.
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < bulkDownloadQueue.length) {
        const i = nextIndex++;
        await processItem(i, bulkDownloadQueue[i]);
      }
    };

    await Promise.all(Array.from({ length: BULK_DOWNLOAD_CONCURRENCY }, worker));

    set({ isBulkDownloadComplete: true });

    // For fresh downloads (startBulkDownload): auto-redirect to session browser.
    // For resumed sessions (resumeFromSession): stay on the bulk download screen and
    // show after-complete options — avoids an infinite loop where every resume
    // triggers another redirect back to the session browser.
    if (!get().CLIMode && !get().isResumedSession) {
      get().resetBulkDownloadQueue();
      get().setActiveLayout(LAYOUT_KEY.SESSION_BROWSER_LAYOUT);
    }
  },

  startBulkDownload: async () => {
    const entries = Object.values(get().bulkDownloadSelectedEntries);
    if (entries.length === 0) {
      get().setWarningMessage("Bulk download queue is empty");
      return;
    }

    const downloadDir = path.join(BASE_DOWNLOAD_DIR, sanitizeFolderName(get().searchValue));
    fs.mkdirSync(downloadDir, { recursive: true });
    initDownloadedFile(downloadDir);
    initFailedFile(downloadDir);

    set({
      completedBulkDownloadItemCount: 0,
      skippedBulkDownloadItemCount: 0,
      failedBulkDownloadItemCount: 0,
      downloadDir,
      isBulkDownloadComplete: false,
      isResumedSession: false,
    });
    get().setActiveLayout(LAYOUT_KEY.BULK_DOWNLOAD_LAYOUT);

    // initialize bulk queue and session items in one pass
    const bulkDownloadQueue: IBulkDownloadQueueItem[] = [];
    const sessionItems: SessionItem[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const detailPageURL = get().mirrorAdapter?.getPageURL(entry.mirror);
      if (!detailPageURL) {
        continue;
      }

      const urlObject = new URL(detailPageURL);
      const md5 = urlObject.searchParams.get("md5");
      if (!md5) {
        get().setWarningMessage(`Couldn't find MD5 for entry ${entry.id}`);
        continue;
      }

      bulkDownloadQueue.push({
        md5,
        status: DownloadStatus.IN_QUEUE,
        filename: "",
        progress: 0,
        total: 0,
      });

      sessionItems.push({ md5, title: entry.title, filename: "", status: "in_queue" });
    }

    saveSession(
      {
        timestamp: new Date().toISOString(),
        searchPhrase: get().searchValue,
        items: sessionItems,
      },
      downloadDir
    );

    set({ bulkDownloadQueue });

    get().operateBulkDownloadQueue();
  },

  startBulkDownloadInCLI: async (md5List: string[], folderName: string) => {
    const downloadDir = path.join(BASE_DOWNLOAD_DIR, sanitizeFolderName(folderName));
    fs.mkdirSync(downloadDir, { recursive: true });
    initDownloadedFile(downloadDir);
    initFailedFile(downloadDir);

    saveSession(
      {
        timestamp: new Date().toISOString(),
        searchPhrase: folderName,
        items: md5List.map((md5) => ({ md5, title: "", filename: "", status: "in_queue" })),
      },
      downloadDir
    );

    set({
      downloadDir,
      bulkDownloadQueue: md5List.map((md5) => ({
        md5,
        status: DownloadStatus.IN_QUEUE,
        filename: "",
        progress: 0,
        total: 0,
      })),
    });

    await get().operateBulkDownloadQueue();

    // process exit successfully
    get().handleExit();
  },

  resumeFromSession: (session: Session, downloadDir: string) => {
    // Ensure tracking files exist
    try {
      initDownloadedFile(downloadDir);
      initFailedFile(downloadDir);
    } catch {
      // non-fatal
    }

    // Preserve titles from previous session; reset all statuses to in_queue
    saveSession(
      {
        timestamp: new Date().toISOString(),
        searchPhrase: session.searchPhrase,
        items: session.items.map((item) => ({
          md5: item.md5,
          title: item.title,
          filename: "",
          status: "in_queue",
        })),
      },
      downloadDir
    );

    set({
      completedBulkDownloadItemCount: 0,
      skippedBulkDownloadItemCount: 0,
      failedBulkDownloadItemCount: 0,
      downloadDir,
      isBulkDownloadComplete: false,
      isResumedSession: true,
      bulkDownloadQueue: session.items.map((item) => ({
        md5: item.md5,
        status: DownloadStatus.IN_QUEUE,
        filename: "",
        progress: 0,
        total: 0,
      })),
    });

    get().setActiveLayout(LAYOUT_KEY.BULK_DOWNLOAD_LAYOUT);
    get().operateBulkDownloadQueue();
  },

  resetBulkDownloadQueue: () => {
    set({
      ...initialBulkDownloadQueueState,
    });
  },
  };
};
