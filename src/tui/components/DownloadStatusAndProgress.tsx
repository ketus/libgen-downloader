import React from "react";
import { Text } from "ink";
import { IDownloadProgress } from "../store/download-queue";
import { getDownloadProgress } from "../helpers/progress";
import { DownloadStatus, downloadStatusIndicators } from "../../download-statuses";

interface Props {
  downloadProgressData: IDownloadProgress;
}

export function DownloadStatusAndProgress({ downloadProgressData }: Props) {
  const downloadProgress = getDownloadProgress(
    downloadProgressData.progress || 0,
    downloadProgressData.total
  );

  const noProgressStatuses = [DownloadStatus.DOWNLOADED, DownloadStatus.ALREADY_DOWNLOADED, DownloadStatus.FAILED];

  return (
    <Text>
      {downloadStatusIndicators[downloadProgressData.status]}{" "}
      {!noProgressStatuses.includes(downloadProgressData.status) && (
        <>
          <Text color="white">
            {downloadProgress?.progressPercentage}% {downloadProgress?.downloadedSize} /{" "}
            {downloadProgress?.totalSize}
          </Text>{" "}
        </>
      )}
    </Text>
  );
}
