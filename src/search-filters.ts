export interface SearchFilters {
  columns: string[];
  objects: string[];
  topics: string[];
}

export const DEFAULT_COLUMNS = ["t", "a", "s", "y", "p", "i"];
export const DEFAULT_OBJECTS = ["f", "e", "s", "a", "p", "w"];
export const DEFAULT_TOPICS = ["l", "c", "f", "a", "m", "r", "s"];

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  columns: [...DEFAULT_COLUMNS],
  objects: [...DEFAULT_OBJECTS],
  topics: [...DEFAULT_TOPICS],
};

export const COLUMN_LABELS: Record<string, string> = {
  t: "Title",
  a: "Author(s)",
  s: "Series",
  y: "Year",
  p: "Publisher",
  i: "ISBN",
};

export const OBJECT_LABELS: Record<string, string> = {
  f: "Files",
  e: "Editions",
  s: "Series",
  a: "Authors",
  p: "Publishers",
  w: "Works",
};

export const TOPIC_LABELS: Record<string, string> = {
  l: "Libgen",
  c: "Comics",
  f: "Fiction",
  a: "Sci. Articles",
  m: "Magazines",
  r: "Fiction RUS",
  s: "Standards",
};
