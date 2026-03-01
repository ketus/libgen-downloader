import React, { useState } from "react";
import { Box, Text } from "ink";
import { useListControls } from "../../hooks/useListControls";
import { useBoundStore } from "../../store";
import { LAYOUT_KEY } from "../keys";
import {
  DEFAULT_COLUMNS,
  DEFAULT_OBJECTS,
  DEFAULT_TOPICS,
  COLUMN_LABELS,
  OBJECT_LABELS,
  TOPIC_LABELS,
} from "../../../search-filters";
import figures from "figures";

type FilterItem =
  | { kind: "toggle"; key: string; group: "columns" | "objects" | "topics"; label: string }
  | { kind: "action"; id: "toggle_all" | "search" | "cancel"; label: string };

const ALL_ITEMS: FilterItem[] = [
  ...DEFAULT_COLUMNS.map((k) => ({ kind: "toggle" as const, key: k, group: "columns" as const, label: COLUMN_LABELS[k] })),
  ...DEFAULT_OBJECTS.map((k) => ({ kind: "toggle" as const, key: k, group: "objects" as const, label: OBJECT_LABELS[k] })),
  ...DEFAULT_TOPICS.map((k) => ({ kind: "toggle" as const, key: k, group: "topics" as const, label: TOPIC_LABELS[k] })),
  { kind: "action", id: "toggle_all", label: "Toggle all" },
  { kind: "action", id: "search", label: "Start search" },
  { kind: "action", id: "cancel", label: "Cancel" },
];

export function SearchFilters() {
  const searchValue = useBoundStore((state) => state.searchValue);
  const setSearchFilters = useBoundStore((state) => state.setSearchFilters);
  const confirmSearch = useBoundStore((state) => state.confirmSearch);
  const setActiveLayout = useBoundStore((state) => state.setActiveLayout);

  const [columns, setColumns] = useState<string[]>([...DEFAULT_COLUMNS]);
  const [objects, setObjects] = useState<string[]>([...DEFAULT_OBJECTS]);
  const [topics, setTopics] = useState<string[]>([...DEFAULT_TOPICS]);

  const isEnabled = (item: FilterItem): boolean => {
    if (item.kind !== "toggle") return false;
    if (item.group === "columns") return columns.includes(item.key);
    if (item.group === "objects") return objects.includes(item.key);
    return topics.includes(item.key);
  };

  const toggle = (item: FilterItem) => {
    if (item.kind !== "toggle") return;
    if (item.group === "columns") {
      setColumns((prev) =>
        prev.includes(item.key) ? prev.filter((k) => k !== item.key) : [...prev, item.key]
      );
    } else if (item.group === "objects") {
      setObjects((prev) =>
        prev.includes(item.key) ? prev.filter((k) => k !== item.key) : [...prev, item.key]
      );
    } else {
      setTopics((prev) =>
        prev.includes(item.key) ? prev.filter((k) => k !== item.key) : [...prev, item.key]
      );
    }
  };

  const allEnabled = columns.length === DEFAULT_COLUMNS.length &&
    objects.length === DEFAULT_OBJECTS.length &&
    topics.length === DEFAULT_TOPICS.length;

  const handleSelect = (item: FilterItem) => {
    if (item.kind === "toggle") {
      toggle(item);
      return;
    }
    if (item.id === "toggle_all") {
      if (allEnabled) {
        setColumns([]);
        setObjects([]);
        setTopics([]);
      } else {
        setColumns([...DEFAULT_COLUMNS]);
        setObjects([...DEFAULT_OBJECTS]);
        setTopics([...DEFAULT_TOPICS]);
      }
      return;
    }
    if (item.id === "search") {
      setSearchFilters({ columns, objects, topics });
      confirmSearch();
      return;
    }
    if (item.id === "cancel") {
      setActiveLayout(LAYOUT_KEY.SEARCH_LAYOUT);
    }
  };

  const { selectedOptionIndex } = useListControls(ALL_ITEMS, handleSelect);

  const renderItem = (item: FilterItem, index: number) => {
    const isActive = index === selectedOptionIndex;
    const cursor = isActive ? figures.pointer : " ";

    if (item.kind === "toggle") {
      const checked = isEnabled(item) ? "[✓]" : "[ ]";
      return (
        <Text key={`${item.group}-${item.key}`} color={isActive ? "cyan" : undefined}>
          {cursor} {checked} {item.label}
        </Text>
      );
    }

    const label = item.id === "toggle_all" ? (allEnabled ? "Toggle all off" : "Toggle all on") : item.label;
    return (
      <Text key={item.id} color={isActive ? "cyan" : undefined}>
        {cursor} {label}
      </Text>
    );
  };

  const columnItems = ALL_ITEMS.slice(0, DEFAULT_COLUMNS.length);
  const objectItems = ALL_ITEMS.slice(DEFAULT_COLUMNS.length, DEFAULT_COLUMNS.length + DEFAULT_OBJECTS.length);
  const topicItems = ALL_ITEMS.slice(DEFAULT_COLUMNS.length + DEFAULT_OBJECTS.length, DEFAULT_COLUMNS.length + DEFAULT_OBJECTS.length + DEFAULT_TOPICS.length);
  const actionItems = ALL_ITEMS.slice(DEFAULT_COLUMNS.length + DEFAULT_OBJECTS.length + DEFAULT_TOPICS.length);

  const columnOffset = 0;
  const objectOffset = DEFAULT_COLUMNS.length;
  const topicOffset = DEFAULT_COLUMNS.length + DEFAULT_OBJECTS.length;
  const actionOffset = DEFAULT_COLUMNS.length + DEFAULT_OBJECTS.length + DEFAULT_TOPICS.length;

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Search: &quot;{searchValue}&quot;</Text>

      <Box flexDirection="column">
        <Text dimColor>Fields:</Text>
        {columnItems.map((item, i) => renderItem(item, columnOffset + i))}
      </Box>

      <Box flexDirection="column">
        <Text dimColor>Objects:</Text>
        {objectItems.map((item, i) => renderItem(item, objectOffset + i))}
      </Box>

      <Box flexDirection="column">
        <Text dimColor>Topics:</Text>
        {topicItems.map((item, i) => renderItem(item, topicOffset + i))}
      </Box>

      <Box flexDirection="column">
        <Text dimColor>{"─".repeat(30)}</Text>
        {actionItems.map((item, i) => renderItem(item, actionOffset + i))}
      </Box>
    </Box>
  );
}
