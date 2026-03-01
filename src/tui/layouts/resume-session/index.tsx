import React from "react";
import { Box, Text } from "ink";
import { useBoundStore } from "../../store";
import OptionList from "../../components/OptionList";
import { IOption } from "../../components/Option";
import { LAYOUT_KEY } from "../keys";
import { loadSession } from "../../../api/data/session";

export function ResumeSession() {
  const setActiveLayout = useBoundStore((state) => state.setActiveLayout);
  const resumeFromSession = useBoundStore((state) => state.resumeFromSession);

  const session = loadSession();

  if (!session) {
    setActiveLayout(LAYOUT_KEY.SEARCH_LAYOUT);
    return null;
  }

  const downloaded = session.items.filter((i) => i.status === "downloaded").length;
  const failed = session.items.filter((i) => i.status === "failed").length;
  const inQueue = session.items.filter((i) => i.status === "in_queue").length;
  const date = new Date(session.timestamp).toLocaleString();

  const options: Record<string, IOption> = {
    resume: {
      label: `Resume — ${inQueue + failed} item(s) remaining`,
      onSelect: () => resumeFromSession(session),
      order: 0,
    },
    skip: {
      label: "Start fresh",
      onSelect: () => setActiveLayout(LAYOUT_KEY.SEARCH_LAYOUT),
      order: 1,
    },
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>Previous download session found</Text>
        <Text color="gray">{date}</Text>
      </Box>

      {session.searchPhrase ? (
        <Text>
          Search: <Text color="cyan">"{session.searchPhrase}"</Text>
        </Text>
      ) : null}

      <Box gap={2}>
        <Text>
          Total: <Text color="white">{session.items.length}</Text>
        </Text>
        <Text>
          Downloaded: <Text color="green">{downloaded}</Text>
        </Text>
        <Text>
          Failed: <Text color="red">{failed}</Text>
        </Text>
        <Text>
          In queue: <Text color="yellow">{inQueue}</Text>
        </Text>
      </Box>

      <OptionList options={options} />
    </Box>
  );
}
