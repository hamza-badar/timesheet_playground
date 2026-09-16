import dayjs from "dayjs";
import { textMatchesLeavePattern } from "./filters";
import type { TimelogEntry } from "./types";

export interface SheetFeedRow {
  id: string;
  date: string;
  jiraId: string;
  task: string;
  effort: number;
  status: string;
  sprint: string;
  /** Used for Zoho export when Jira ID is empty. Ignored when Jira ID is set. */
  jobName?: string;
}

export const JOB_NAME_OPTIONS = [
  "Client Calls",
  "Development",
  "Internal Calls",
  "Training",
] as const;

export const DEFAULT_NO_JIRA_JOB_NAME = "Client Calls";

export interface SheetFeedState {
  personName: string;
  year: number;
  month: number;
  rows: SheetFeedRow[];
}

export const SHEET_STATUSES = [
  { value: "", label: "None" },
  { value: "DONE", label: "DONE" },
  { value: "IN-PROGRESS", label: "IN-PROGRESS" },
  { value: "QA", label: "QA" },
  { value: "STAGE", label: "STAGE" },
  { value: "PROD", label: "PROD" },
  { value: "PR-IN-REVIEW", label: "PR-IN-REVIEW" },
  { value: "DEV-COMPLETED", label: "DEV-COMPLETED" },
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

export interface SheetFeedStore {
  drafts: Record<string, SheetFeedState>;
  lastKey: string;
  knownNames: string[];
}

function emptyStore(): SheetFeedStore {
  return { drafts: {}, lastKey: "", knownNames: [] };
}

function readStore(): SheetFeedStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as SheetFeedStore;
    if (!parsed.drafts) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: SheetFeedStore) {
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

export function snapshotSheetFeedStore(): SheetFeedStore {
  return readStore();
}

export function replaceSheetFeedStore(store: SheetFeedStore) {
  if (!store || typeof store !== "object" || !store.drafts || typeof store.drafts !== "object") {
    throw new Error("Invalid sheet builder backup");
  }
  const drafts: Record<string, SheetFeedState> = {};
  for (const [key, value] of Object.entries(store.drafts)) {
    if (!value || typeof value !== "object" || !Array.isArray(value.rows)) continue;
    drafts[key] = {
      personName: String(value.personName || ""),
      year: Number(value.year) || 0,
      month: Number(value.month) || 0,
      rows: value.rows,
    };
  }
  writeStore({
    drafts,
    lastKey: typeof store.lastKey === "string" ? store.lastKey : "",
    knownNames: Array.isArray(store.knownNames)
      ? store.knownNames.filter((n): n is string => typeof n === "string")
      : [],
  });
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

function inferJobName(jiraId: string, jobName?: string): string {
  if (jiraId && jiraId.trim().length > 0) return "Development";
  const trimmed = (jobName || "").trim();
  if (trimmed) return trimmed;
  return DEFAULT_NO_JIRA_JOB_NAME;
}

function normalizeStatus(status: string): string {
  const s = status.toUpperCase().trim();
  if (s === "DONE" || s === "DEV-COMPLETE" || s === "PROD") return "Done";
  if (
    s === "INPROGRESS" ||
    s === "IN-PROGRESS" ||
    s === "IN-PRORESS" ||
    s === "IN PROGRESS" ||
    s === "IN-PORGRESS"
  ) {
    return "In Progress";
  }
  if (s === "STAGE") return "Stage";
  if (s === "") return "";
  return status;
}

/**
 * Maps sheet-builder lines to TimelogEntry rows using the same rules as the
 * converter parser (skip empty/leave, infer Job Name from Jira ID).
 */
export function isExportableFeedRow(row: SheetFeedRow): boolean {
  if (!row.task && !row.jiraId && !row.effort) return false;
  if (textMatchesLeavePattern(row.task) || textMatchesLeavePattern(row.jiraId)) {
    return false;
  }
  return true;
}

export function sheetFeedToTimelogEntries(
  personName: string,
  rows: SheetFeedRow[]
): TimelogEntry[] {
  const name = personName.trim();
  if (!name) return [];

  const entries: TimelogEntry[] = [];
  for (const row of rows) {
    if (!isExportableFeedRow(row)) continue;
    const d = dayjs(row.date);
    entries.push({
      name,
      month: d.isValid() ? d.format("MMMM") : "",
      date: row.date,
      day: d.isValid() ? d.format("dddd") : "",
      jiraId: row.jiraId,
      task: row.task,
      effort: row.effort || 0,
      status: normalizeStatus(row.status),
      sprint: row.sprint,
      jobName: inferJobName(row.jiraId, row.jobName),
      billing: "Billable",
    });
  }
  return entries;
}
