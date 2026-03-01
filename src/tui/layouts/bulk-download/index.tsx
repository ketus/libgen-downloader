import React from "react";
import { Box, Text, useInput } from "ink";
import { useBoundStore } from "../../store";
import { DownloadStatusAndProgress } from "../../components/DownloadStatusAndProgress";
import { BulkDownloadAfterCompleteOptions } from "./BulkDownloadAfterCompleteOptions";
import path from "path";

export function BulkDownload() {
  const bulkDownloadQueue = useBoundStore((state) => state.bulkDownloadQueue);
  const isBulkDownloadComplete = useBoundStore((state) => state.isBulkDownloadComplete);
  const completedBulkDownloadItemCount = useBoundStore(
    (state) => state.completedBulkDownloadItemCount
  );
  const skippedBulkDownloadItemCount = useBoundStore(
    (state) => state.skippedBulkDownloadItemCount
  );
  const failedBulkDownloadItemCount = useBoundStore((state) => state.failedBulkDownloadItemCount);
  const downloadDir = useBoundStore((state) => state.downloadDir);
  const CLIMode = useBoundStore((state) => state.CLIMode);
  const skipCurrentBulkItem = useBoundStore((state) => state.skipCurrentBulkItem);
  const totalItemCount = bulkDownloadQueue.length;

  useInput((input) => {
    if (input.toLowerCase() === "s") {
      skipCurrentBulkItem();
    }
  });

  const failedFilePath = downloadDir ? path.join(downloadDir, "failed.jsonl") : "";

  return (
    <Box flexDirection="column">
      <Box paddingLeft={3} flexDirection="column">
        <Text wrap="truncate-end">
          <Text color="greenBright">COMPLETED ({completedBulkDownloadItemCount}) </Text>
          <Text color="cyan">SKIPPED ({skippedBulkDownloadItemCount}) </Text>
          <Text color="redBright">FAILED ({failedBulkDownloadItemCount}) </Text>
          <Text color="white">TOTAL ({totalItemCount})</Text>
        </Text>

        {downloadDir ? (
          <Text color="gray">
            Saving to: <Text color="blueBright">{downloadDir}</Text>
          </Text>
        ) : null}

        {failedBulkDownloadItemCount > 0 && failedFilePath ? (
          <Text color="gray">
            Failed MD5 list:{" "}
            <Text color="redBright">{failedFilePath}</Text>
            <Text color="gray"> (retry with: libgen-downloader -b {failedFilePath} --name "...")</Text>
          </Text>
        ) : null}

        {bulkDownloadQueue.map((item, idx) => (
          <Text key={idx} wrap="truncate-end">
            <DownloadStatusAndProgress downloadProgressData={item} />
            {item.filename ? (
              <Text>
                <Text color="green">{item.filename}</Text>
              </Text>
            ) : item.md5 ? (
              <Text>
                <Text color="gray">md5: </Text>
                <Text color="green">{item.md5}</Text>
              </Text>
            ) : (
              <Text color="gray">-</Text>
            )}
          </Text>
        ))}

        {!CLIMode && !isBulkDownloadComplete && (
          <Text color="gray">Press S to skip active items</Text>
        )}

        {!CLIMode && isBulkDownloadComplete && <BulkDownloadAfterCompleteOptions />}
      </Box>
    </Box>
  );
}
