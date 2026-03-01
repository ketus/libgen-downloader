import React from "react";
import { Box, Text } from "ink";
import { useBoundStore } from "../../store";
import OptionList from "../../components/OptionList";
import { IOption } from "../../components/Option";
import { findAllSessions, Session } from "../../../api/data/session";

export function SessionBrowser() {
  const resumeFromSession = useBoundStore((state) => state.resumeFromSession);
  const backToSearch = useBoundStore((state) => state.backToSearch);

  const sessions = findAllSessions();

  if (sessions.length === 0) {
    backToSearch();
    return null;
  }

  const options: Record<string, IOption> = {};

  sessions.forEach(({ session, downloadDir }, idx) => {
    const downloaded = session.items.filter((i) => i.status === "downloaded").length;
    const failed = session.items.filter((i) => i.status === "failed").length;
    const inQueue = session.items.filter((i) => i.status === "in_queue").length;
    const incomplete = inQueue + failed;
    const date = new Date(session.timestamp).toLocaleString();
    const folderName = downloadDir.replace(/^libgen-downloads[/\\]/, "");

    const statusSuffix = incomplete > 0 ? ` — ${incomplete} remaining` : " — complete";

    options[`session_${idx}`] = {
      label: `[${folderName}]  ${date}  |  ${session.items.length} total  ✓${downloaded}  ✗${failed}  ⏳${inQueue}${statusSuffix}`,
      onSelect: () => resumeFromSession(session, downloadDir),
      order: idx,
    };
  });

  options["start_fresh"] = {
    label: "Start fresh search",
    onSelect: () => backToSearch(),
    order: sessions.length,
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Download sessions</Text>
      <OptionList options={options} />
    </Box>
  );
}
