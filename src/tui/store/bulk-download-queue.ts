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
import { initDownloadedFile, initFailedFile, appendMD5ToFile, appendFailedEntry } from "../../api/data/file";
import { loadDownloadedMD5s, recordDownloaded } from "../../api/data/downloadHistory";
import { saveSession, loadSession, Session, SessionItem } from "../../api/data/session";
import objectHash from "object-hash";

const BASE_DOWNLOAD_DIR = "libgen-downloads";

export interface IBulkDownloadQueueItem extends IDownloadProgress {
  md5: string;
}

export interface IBulkDownloadQueueState {
  isBulkDownloadComplete: boolean;

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
  operateBulkDownloadQueue: () => Promise<void>;
  startBulkDownload: () => Promise<void>;
  startBulkDownloadInCLI: (md5List: string[], folderName: string) => Promise<void>;
  resumeFromSession: (session: Session, downloadDir: string) => void;
  resetBulkDownloadQueue: () => void;
}

export const initialBulkDownloadQueueState = {
  isBulkDownloadComplete: false,

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

    for (let i = 0; i < bulkDownloadQueue.length; i++) {
      const item = bulkDownloadQueue[i];

      // Skip items that were downloaded in a previous session
      if (downloadedMD5s.has(item.md5.toLowerCase())) {
        get().onBulkQueueItemSkip(i);
        continue;
      }

      const detailPageUrl = get().mirrorAdapter?.getDetailPageURL(item.md5);
      if (!detailPageUrl) {
        get().setWarningMessage(`Couldn't get the detail page URL for ${item.md5}`);
        get().onBulkQueueItemFail(i);
        appendToFailedFile(item.md5, "Couldn't construct detail page URL");
        updateSession(item.md5, "failed");
        continue;
      }

      get().onBulkQueueItemProcessing(i);

      const detailPageDocument = await attempt(() => getDocument(detailPageUrl));
      if (!detailPageDocument) {
        get().setWarningMessage(`Couldn't fetch the detail page for ${item.md5}`);
        get().onBulkQueueItemFail(i);
        appendToFailedFile(item.md5, "Couldn't fetch detail page");
        updateSession(item.md5, "failed");
        continue;
      }

      const downloadUrl = get().mirrorAdapter?.getMainDownloadURLFromDocument(detailPageDocument);
      if (!downloadUrl) {
        get().setWarningMessage(`Couldn't find the download url for ${item.md5}`);
        get().onBulkQueueItemFail(i);
        appendToFailedFile(item.md5, "Couldn't find download URL in detail page");
        updateSession(item.md5, "failed");
        continue;
      }

      const downloadStream = await attempt(() => fetch(downloadUrl));
      if (!downloadStream) {
        get().setWarningMessage(`Couldn't fetch the download stream for ${item.md5}`);
        get().onBulkQueueItemFail(i);
        appendToFailedFile(item.md5, "Couldn't fetch download stream");
        updateSession(item.md5, "failed");
        continue;
      }

      let downloadedFilename = "";
      try {
        await downloadFile({
          downloadStream,
          downloadDir,
          onStart: (filename, total) => {
            downloadedFilename = filename;
            get().onBulkQueueItemStart(i, filename, total);
          },
          onData: (filename, chunk, total) => {
            get().onBulkQueueItemData(i, filename, chunk, total);
          },
        });

        get().onBulkQueueItemComplete(i);
        updateSession(item.md5, "downloaded", downloadedFilename);
        try {
          appendMD5ToFile(downloadedFilePath, item.md5);
        } catch {
          // non-fatal
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Download failed";
        get().onBulkQueueItemFail(i);
        appendToFailedFile(item.md5, reason);
        updateSession(item.md5, "failed");
      }
    }

    set({ isBulkDownloadComplete: true });
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
