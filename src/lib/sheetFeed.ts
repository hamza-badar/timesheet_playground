import dayjs from "dayjs";

export interface SheetFeedRow {
  id: string;
  date: string;
  jiraId: string;
  task: string;
  effort: number;
  status: string;
  sprint: string;
}

export interface SheetFeedState {
  personName: string;
  year: number;
  month: number;
  rows: SheetFeedRow[];
}

export const SHEET_STATUSES = [
  "DONE",
  "IN-PROGRESS",
  "QA",
  "STAGE",
  "PROD",
  "PR-IN-REVIEW",
  "DEV-COMPLETED",
  "Done",
  "InProgress",
] as const;

export const FEED_HEADERS = [
  "Date",
  "Day",
  "Jira ID",
  "Task",
  "Effort",
  "Working Days",
  "Status",
  "Sprint",
] as const;

const STORAGE_KEY = "timesheet-prosper-feed-v1";

interface FeedStore {
  drafts: Record<string, SheetFeedState>;
  lastKey: string;
  knownNames: string[];
}

function emptyStore(): FeedStore {
  return { drafts: {}, lastKey: "", knownNames: [] };
}

function readStore(): FeedStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as FeedStore;
    if (!parsed.drafts) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: FeedStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

export function feedKey(personName: string, year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}:${personName.trim()}`;
}

export function loadFeed(personName: string, year: number, month: number): SheetFeedState {
  const store = readStore();
  const key = feedKey(personName, year, month);
  return (
    store.drafts[key] || {
      personName,
      year,
      month,
      rows: [],
    }
  );
}

export function saveFeed(state: SheetFeedState) {
  const store = readStore();
  const key = feedKey(state.personName, state.year, state.month);
  store.drafts[key] = state;
  store.lastKey = key;
  const name = state.personName.trim();
  if (name && !store.knownNames.includes(name)) {
    store.knownNames = [...store.knownNames, name].sort();
  }
  writeStore(store);
}

export function loadLastFeedHint(): {
  personName: string;
  year: number;
  month: number;
  knownNames: string[];
} {
  const store = readStore();
  const now = dayjs();
  if (!store.lastKey) {
    return {
      personName: store.knownNames[0] || "",
      year: now.year(),
      month: now.month() + 1,
      knownNames: store.knownNames,
    };
  }
  const [ym, ...nameParts] = store.lastKey.split(":");
  const [yearStr, monthStr] = ym.split("-");
  return {
    personName: nameParts.join(":") || "",
    year: Number(yearStr) || now.year(),
    month: Number(monthStr) || now.month() + 1,
    knownNames: store.knownNames,
  };
}

export function isWeekendIso(dateStr: string): boolean {
  const d = dayjs(dateStr);
  const dow = d.day();
  return dow === 0 || dow === 6;
}

export function isLeaveTask(task: string): boolean {
  if (!task) return false;
  const lower = task.toLowerCase();
  return (
    lower.includes("sick") ||
    lower.includes("planned leave") ||
    lower.includes("pto") ||
    lower.includes("vacation") ||
    lower.includes("holiday") ||
    lower.includes("leave") ||
    lower.includes("half day cl") ||
    lower.includes("comp off")
  );
}

export type BuiltRowKind = "weekend" | "leave" | "work";

export interface BuiltSheetRow {
  sourceId: string | null;
  date: string | null;
  day: string | null;
  dateIso: string;
  jiraId: string;
  task: string;
  effort: number | "";
  status: string;
  sprint: string;
  kind: BuiltRowKind;
  mergeCount: number;
}

export function buildMonthRows(
  year: number,
  month: number,
  rows: SheetFeedRow[]
): BuiltSheetRow[] {
  const start = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const days = start.daysInMonth();
  const byDate = new Map<string, SheetFeedRow[]>();
  for (const row of rows) {
    if (!row.date) continue;
    const list = byDate.get(row.date) || [];
    list.push(row);
    byDate.set(row.date, list);
  }

  const out: BuiltSheetRow[] = [];
  for (let d = 1; d <= days; d++) {
    const iso = start.date(d).format("YYYY-MM-DD");
    const dayName = start.date(d).format("dddd");
    const weekend = isWeekendIso(iso);
    const entries = byDate.get(iso) || [];

    if (entries.length === 0) {
      out.push({
        sourceId: null,
        date: iso,
        day: dayName,
        dateIso: iso,
        jiraId: "",
        task: "",
        effort: "",
        status: "",
        sprint: "",
        kind: weekend ? "weekend" : "work",
        mergeCount: 1,
      });
      continue;
    }

    entries.forEach((entry, idx) => {
      const leave = isLeaveTask(entry.task);
      out.push({
        sourceId: entry.id,
        date: idx === 0 ? iso : null,
        day: idx === 0 ? dayName : null,
        dateIso: iso,
        jiraId: entry.jiraId,
        task: entry.task,
        effort: entry.effort || "",
        status: entry.status,
        sprint: entry.sprint,
        kind: weekend ? "weekend" : leave ? "leave" : "work",
        mergeCount: idx === 0 ? entries.length : 0,
      });
    });
  }
  return out;
}

export function newRowId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
