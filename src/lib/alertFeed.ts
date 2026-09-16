export interface AlertEntry {
  id: string;
  date: string;
  onSupport: string;
  priority: string;
  title: string;
  summary: string;
  action: string;
  status: string;
}

export interface AlertFeedState {
  onSupport: string;
  rows: AlertEntry[];
}

export interface BuiltAlertGroup {
  serial: number;
  date: string;
  onSupport: string;
  alerts: AlertEntry[];
}

export const ALERT_HEADERS = ["S. No.", "Date", "On Support", "Alert(s) Action"] as const;

export const ALERT_PRIORITIES = ["", "P0", "P1", "P2", "P3", "P4"] as const;

const STORAGE_KEY = "timesheet-alert-feed-v1";

interface AlertStore {
  draft: AlertFeedState;
}

function emptyState(): AlertFeedState {
  return { onSupport: "", rows: [] };
}

function emptyStore(): AlertStore {
  return { draft: emptyState() };
}

function readStore(): AlertStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as AlertStore;
    if (!parsed?.draft?.rows || !Array.isArray(parsed.draft.rows)) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: AlertStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

export function newAlertId(): string {
  return `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadAlertFeed(): AlertFeedState {
  return readStore().draft;
}

export function saveAlertFeed(draft: AlertFeedState) {
  writeStore({ draft });
}

export function snapshotAlertFeed(): AlertFeedState {
  return readStore().draft;
}

export function replaceAlertFeed(draft: AlertFeedState) {
  if (!draft || typeof draft !== "object" || !Array.isArray(draft.rows)) {
    throw new Error("Invalid alerts backup");
  }
  writeStore({
    draft: {
      onSupport: typeof draft.onSupport === "string" ? draft.onSupport : "",
      rows: draft.rows.filter((row) => row && typeof row === "object"),
    },
  });
}

export function buildAlertGroups(rows: AlertEntry[]): BuiltAlertGroup[] {
  const sorted = [...rows].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const personCmp = a.onSupport.localeCompare(b.onSupport);
    if (personCmp !== 0) return personCmp;
    return a.id.localeCompare(b.id);
  });

  const groups: BuiltAlertGroup[] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.date && last.onSupport === row.onSupport) {
      last.alerts.push(row);
    } else {
      groups.push({
        serial: groups.length + 1,
        date: row.date,
        onSupport: row.onSupport,
        alerts: [row],
      });
    }
  }
  return groups;
}

export function formatAlertTitle(index: number, alert: AlertEntry): string {
  const title = alert.title.trim();
  const priority = alert.priority.trim();
  if (priority) return `[${index}] ${priority} | ${title}`;
  return `[${index}] ${title}`;
}

export function formatAlertPlainText(index: number, alert: AlertEntry): string {
  const lines = [formatAlertTitle(index, alert)];
  if (alert.summary.trim()) lines.push(`Summary: ${alert.summary.trim()}`);
  if (alert.action.trim()) lines.push(`Action: ${alert.action.trim()}`);
  if (alert.status.trim()) lines.push(`Status: ${alert.status.trim()}`);
  return lines.join("\n");
}
