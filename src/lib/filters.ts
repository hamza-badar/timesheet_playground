import type { TimelogEntry } from "./types";

export const LEAVE_PATTERNS = [
  "leave",
  "holiday",
  "weekend off",
  "vacation",
  "pto",
  "ooo",
  "day off",
  "comp off",
  "absent",
];

export function textMatchesLeavePattern(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return LEAVE_PATTERNS.some((p) => lower.includes(p));
}

export function isLeaveOrHoliday(entry: TimelogEntry): boolean {
  if (textMatchesLeavePattern(entry.task)) return true;
  if (textMatchesLeavePattern(entry.jiraId)) return true;
  if (textMatchesLeavePattern(entry.jobName)) return true;
  if (!entry.jiraId && entry.effort === 0 && entry.task) return true;
  return false;
}
