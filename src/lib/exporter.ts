import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { TimelogEntry, MemberConfig } from "./types";

/**
 * Converts decimal hours to HH:MM format.
 * e.g. 8 -> "08:00", 7.5 -> "07:30", 0.5 -> "00:30"
 */
function toHHMM(hours: number): string {
  if (!hours || hours <= 0) return "";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Converts YYYY-MM-DD to DD/MM/YYYY.
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

const LEAVE_PATTERNS = [
  "leave", "holiday", "weekend off", "vacation", "pto",
  "day off", "comp off", "absent",
];

function isLeaveOrHoliday(task: string): boolean {
  if (!task) return false;
  const lower = task.toLowerCase();
  return LEAVE_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Exports entries into a Timelogs.xlsx matching the exact target format:
 *
 * Date | Client Name | Project Name | Job Name | Employee Id | Mail ID |
 * First name | Last name | Work Item | From time | To time |
 * Timer Intervals | Hour(s) | Hours(HH:MM) | Billable Status | Approval | Description
 */
export function exportTimelogs(
  entries: TimelogEntry[],
  memberConfigs: MemberConfig[],
  filename = "Timelogs.xlsx"
) {
  const configMap = new Map<string, MemberConfig>();
  for (const c of memberConfigs) {
    configMap.set(c.name, c);
  }

  const workbook = XLSX.utils.book_new();

  // Sort all entries by date then by name
  const sorted = [...entries].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.name.localeCompare(b.name);
  });

  const rows = sorted.map((e) => {
    const cfg = configMap.get(e.name);
    const isClientCalls = (e.jobName || "").toLowerCase() === "client calls";
    const isWorkTask = !isLeaveOrHoliday(e.task);
    const workItem = isClientCalls
      ? (e.task || e.jiraId)
      : (e.jiraId || (isWorkTask ? e.task : ""));
    const description = isClientCalls
      ? ""
      : (e.jiraId ? e.task : (isLeaveOrHoliday(e.task) ? e.task : ""));
    return {
      "Date": formatDate(e.date),
      "Client Name": cfg?.clientName || "",
      "Project Name": cfg?.projectName || "Prosper",
      "Job Name": e.jobName || "Development",
      "Employee Id": cfg?.employeeId || "",
      "Mail ID": cfg?.email || "",
      "First name": cfg?.firstName || "",
      "Last name": cfg?.lastName || "",
      "Work Item": workItem,
      "From time": "",
      "To time": "",
      "Timer Intervals": "",
      "Hour(s)": e.effort > 0 ? e.effort : "",
      "Hours(HH:MM)": toHHMM(e.effort),
      "Billable Status": e.billing || "Billable",
      "Approval": "",
      "Description": description,
    };
  });

  const sheet = XLSX.utils.json_to_sheet(rows);

  sheet["!cols"] = [
    { wch: 12 },  // Date
    { wch: 16 },  // Client Name
    { wch: 16 },  // Project Name
    { wch: 20 },  // Job Name
    { wch: 14 },  // Employee Id
    { wch: 26 },  // Email ID
    { wch: 14 },  // First name
    { wch: 14 },  // Last name
    { wch: 14 },  // Work Item
    { wch: 10 },  // From time
    { wch: 10 },  // To time
    { wch: 14 },  // Timer Intervals
    { wch: 10 },  // Hour(s)
    { wch: 14 },  // Hours(HH:MM)
    { wch: 10 },  // Billing
    { wch: 10 },  // Approval
    { wch: 80 },  // Description
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, "Timelogs");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, filename);
}
