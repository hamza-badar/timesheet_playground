import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import type { TimelogEntry, SprintSummaryItem } from "./types";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/**
 * Generates a sprint deliverable summary.
 *
 * Rules:
 * 1. Only include tasks within the given date range.
 * 2. Include a task if:
 *    - Its status is "Done" (normalized), OR
 *    - It does NOT appear with status "In Progress" in any entry AFTER the end date.
 *      (i.e., it was completed or abandoned by the end of the sprint)
 * 3. Group by user, aggregate effort per Jira ticket.
 * 4. Format as clean bullet points for a Project Manager.
 */
export function generateSprintSummary(
  allEntries: TimelogEntry[],
  startDate: string,
  endDate: string,
  userName?: string,
  sprint?: string
): { items: SprintSummaryItem[]; formatted: string; clipboardFormatted: string } {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  // Find all entries within the date range
  let rangeEntries = allEntries.filter((e) => {
    if (!e.date) return false;
    const d = dayjs(e.date);
    return d.isSameOrAfter(start, "day") && d.isSameOrBefore(end, "day");
  });

  if (userName) {
    rangeEntries = rangeEntries.filter(
      (e) => e.name.toLowerCase() === userName.toLowerCase()
    );
  }

  if (sprint) {
    rangeEntries = rangeEntries.filter((e) => e.sprint === sprint);
  }

  // Find Jira IDs that appear as "In Progress" AFTER the end date
  const inProgressAfterEnd = new Set<string>();
  for (const e of allEntries) {
    if (!e.date || !e.jiraId) continue;
    const d = dayjs(e.date);
    if (d.isAfter(end, "day") && e.status === "In Progress") {
      inProgressAfterEnd.add(`${e.name}::${e.jiraId}`);
    }
  }

  // Group by user + jiraId, keeping track of tasks
  const grouped = new Map<
    string,
    {
      userName: string;
      jiraId: string;
      task: string;
      status: string;
      totalEffort: number;
      hasDoneStatus: boolean;
    }
  >();

  for (const e of rangeEntries) {
    if (!e.jiraId) continue;

    const key = `${e.name}::${e.jiraId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        userName: e.name,
        jiraId: e.jiraId,
        task: e.task,
        status: e.status,
        totalEffort: 0,
        hasDoneStatus: false,
      });
    }
    const item = grouped.get(key)!;
    item.totalEffort += e.effort;
    // Use the latest task description
    if (e.task) item.task = e.task;
    // Track if it ever reached Done status
    if (e.status === "Done" || e.status === "Stage") {
      item.hasDoneStatus = true;
      item.status = e.status;
    }
    // Update status to the latest one
    if (!item.hasDoneStatus && e.status) {
      item.status = e.status;
    }
  }

  // Filter: keep only items that are Done/Stage OR not still In Progress after end date
  const items: SprintSummaryItem[] = [];
  for (const [, item] of grouped) {
    const compositeKey = `${item.userName}::${item.jiraId}`;
    const stillInProgress = inProgressAfterEnd.has(compositeKey);

    if (item.hasDoneStatus || !stillInProgress) {
      items.push({
        userName: item.userName,
        jiraId: item.jiraId,
        task: item.task,
        status: item.status || "Done",
        totalEffort: item.totalEffort,
      });
    }
  }

  // Sort by user, then by jiraId
  items.sort((a, b) => {
    const nameCmp = a.userName.localeCompare(b.userName);
    if (nameCmp !== 0) return nameCmp;
    return a.jiraId.localeCompare(b.jiraId);
  });

  const formatted = formatSummary(items, startDate, endDate);
  const clipboardFormatted = formatSummaryForClipboard(items);
  return { items, formatted, clipboardFormatted };
}

export function formatSummaryForClipboard(items: SprintSummaryItem[]): string {
  if (items.length === 0) {
    return "No completed deliverables found for the selected date range.";
  }

  return items
    .map((item) => {
      const jiraPart = item.jiraId ? `[${item.jiraId}] ` : "";
      return `  • ${jiraPart}${item.task}`;
    })
    .join("\n");
}

export function getSprintsInRange(
  allEntries: TimelogEntry[],
  startDate: string,
  endDate: string,
  userName?: string
): string[] {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  const sprints = new Set<string>();
  for (const e of allEntries) {
    if (!e.date || !e.sprint) continue;
    const d = dayjs(e.date);
    if (!d.isSameOrAfter(start, "day") || !d.isSameOrBefore(end, "day")) continue;
    if (userName && e.name.toLowerCase() !== userName.toLowerCase()) continue;
    sprints.add(e.sprint);
  }

  return [...sprints].sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

function formatSummary(
  items: SprintSummaryItem[],
  startDate: string,
  endDate: string
): string {
  if (items.length === 0) {
    return "No completed deliverables found for the selected date range.";
  }

  const lines: string[] = [];
  lines.push(
    `Sprint Deliverables Summary (${dayjs(startDate).format("MMM DD, YYYY")} — ${dayjs(endDate).format("MMM DD, YYYY")})`
  );
  lines.push("=".repeat(70));

  // Group by user
  const byUser = new Map<string, SprintSummaryItem[]>();
  for (const item of items) {
    if (!byUser.has(item.userName)) byUser.set(item.userName, []);
    byUser.get(item.userName)!.push(item);
  }

  for (const [user, userItems] of byUser) {
    lines.push("");
    lines.push(`${user}:`);
    lines.push("-".repeat(40));

    const totalHours = userItems.reduce((sum, i) => sum + i.totalEffort, 0);

    for (const item of userItems) {
      const jiraPart = item.jiraId ? `[${item.jiraId}] ` : "";
      const effortPart = item.totalEffort > 0 ? ` (${item.totalEffort}h)` : "";
      lines.push(`  • ${jiraPart}${item.task}${effortPart}`);
    }

    lines.push("");
    lines.push(`  Total effort: ${totalHours} hours | ${userItems.length} deliverables`);
  }

  return lines.join("\n");
}
