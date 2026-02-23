import * as XLSX from "xlsx";
import dayjs from "dayjs";
import type { TimelogEntry, SheetMeta, UserMeta } from "./types";

/**
 * Dynamically detects user blocks from the sheet structure.
 *
 * Each user's data occupies a block of columns in the sheet. The layout
 * varies across files and even across months within the same file:
 *
 *   - Block widths can be 7, 8, or 9 columns
 *   - Column offsets for Status/Sprint differ
 *   - User name positions differ (col+0 or col+3)
 *
 * The parser detects blocks by finding all "Date" headers in the header row,
 * then discovers user names and column layouts dynamically.
 */

// Month names and common abbreviations for sheet name filtering
const MONTH_PATTERNS: Record<string, string> = {
  jan: "January", january: "January",
  feb: "February", february: "February",
  mar: "March", march: "March",
  apr: "April", april: "April",
  may: "May",
  jun: "June", june: "June",
  jul: "July", july: "July",
  aug: "August", august: "August",
  sep: "September", sept: "September", september: "September",
  oct: "October", october: "October",
  nov: "November", november: "November",
  dec: "December", december: "December",
};

function matchMonthName(sheetName: string): string | null {
  const lower = sheetName.trim().toLowerCase();
  return MONTH_PATTERNS[lower] || null;
}

interface DetectedBlock {
  startCol: number;
  nameCol: number;
  statusOffset: number;
  sprintOffset: number;
}

function excelDateToString(serial: number): string {
  const date = XLSX.SSF.parse_date_code(serial);
  return dayjs(
    new Date(date.y, date.m - 1, date.d)
  ).format("YYYY-MM-DD");
}

function excelDateToDay(serial: number): string {
  const date = XLSX.SSF.parse_date_code(serial);
  return dayjs(new Date(date.y, date.m - 1, date.d)).format("dddd");
}

function cellValue(sheet: XLSX.WorkSheet, row: number, col: number): string | number | undefined {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return undefined;
  return cell.v;
}

function cellString(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const v = cellValue(sheet, row, col);
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function cellNumber(sheet: XLSX.WorkSheet, row: number, col: number): number {
  const v = cellValue(sheet, row, col);
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Finds the header row by scanning rows 5-10 for any column containing "Date".
 */
function findHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let r = 5; r <= 10; r++) {
    for (let c = 0; c <= Math.min(range.e.c, 50); c++) {
      if (cellString(sheet, r, c) === "Date") return r;
    }
  }
  return 6;
}

/**
 * Detects all user blocks in a sheet by finding "Date" columns in the header row.
 * For each block, discovers the user name and column offsets for Status/Sprint.
 */
function detectBlocks(sheet: XLSX.WorkSheet, headerRow: number): DetectedBlock[] {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const blocks: DetectedBlock[] = [];

  const dateColumns: number[] = [];
  for (let c = 0; c <= range.e.c; c++) {
    if (cellString(sheet, headerRow, c) === "Date") {
      dateColumns.push(c);
    }
  }

  for (let i = 0; i < dateColumns.length; i++) {
    const startCol = dateColumns[i];
    const blockEnd = i + 1 < dateColumns.length
      ? dateColumns[i + 1] - 1
      : Math.min(startCol + 15, range.e.c);

    // Find user name in row 0 within the block's column range
    let nameCol = -1;
    for (let nc = startCol; nc <= blockEnd; nc++) {
      const name = cellString(sheet, 0, nc);
      if (name && name.length > 1) {
        nameCol = nc;
        break;
      }
    }
    if (nameCol === -1) continue;

    // Detect Status and Sprint offsets from the header labels
    let statusOffset = -1;
    let sprintOffset = -1;
    for (let hc = startCol; hc <= blockEnd; hc++) {
      const header = cellString(sheet, headerRow, hc).toLowerCase();
      if (header === "status" && statusOffset === -1) {
        statusOffset = hc - startCol;
      }
      if (header === "sprint") {
        sprintOffset = hc - startCol;
      }
    }

    blocks.push({
      startCol,
      nameCol,
      statusOffset: statusOffset >= 0 ? statusOffset : 6,
      sprintOffset: sprintOffset >= 0 ? sprintOffset : 7,
    });
  }

  return blocks;
}

function getMonthFromDuration(duration: string): string {
  const lower = duration.toLowerCase();
  if (lower.includes("jan")) return "January";
  if (lower.includes("feb")) return "February";
  if (lower.includes("mar")) return "March";
  if (lower.includes("apr")) return "April";
  if (lower.includes("may")) return "May";
  if (lower.includes("jun")) return "June";
  if (lower.includes("jul")) return "July";
  if (lower.includes("aug")) return "August";
  if (lower.includes("sep")) return "September";
  if (lower.includes("oct")) return "October";
  if (lower.includes("nov")) return "November";
  if (lower.includes("dec")) return "December";
  return "Unknown";
}

function parseUserBlock(
  sheet: XLSX.WorkSheet,
  block: DetectedBlock,
  headerRow: number,
  month: string
): { entries: TimelogEntry[]; meta: UserMeta } {
  const { startCol, nameCol, statusOffset, sprintOffset } = block;
  const name = cellString(sheet, 0, nameCol);
  if (!name) {
    return {
      entries: [],
      meta: {
        name: "",
        sickLeave: 0,
        vacationsPTO: 0,
        publicHolidays: 0,
        weekends: 0,
        actualWorkingDays: 0,
      },
    };
  }

  const sickLeave = cellNumber(sheet, 1, startCol + 4);
  const vacationsPTO = cellNumber(sheet, 2, startCol + 4);
  const publicHolidays = cellNumber(sheet, 3, startCol + 4);
  const weekends = cellNumber(sheet, 4, startCol + 4);
  const actualWorkingDays = cellNumber(sheet, 4, startCol + 3);

  const meta: UserMeta = {
    name,
    sickLeave,
    vacationsPTO,
    publicHolidays,
    weekends,
    actualWorkingDays,
  };

  const entries: TimelogEntry[] = [];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  let currentDate = "";
  let currentDay = "";

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const rawDate = cellValue(sheet, r, startCol);
    const rawDay = cellString(sheet, r, startCol + 1);
    const jiraId = cellString(sheet, r, startCol + 2);
    const task = cellString(sheet, r, startCol + 3);
    const effort = cellNumber(sheet, r, startCol + 4);
    const status = cellString(sheet, r, startCol + statusOffset);
    const sprint = cellString(sheet, r, startCol + sprintOffset);

    if (rawDate !== undefined && rawDate !== null && rawDate !== "") {
      const dateNum = Number(rawDate);
      if (!isNaN(dateNum) && dateNum > 40000) {
        currentDate = excelDateToString(dateNum);
        currentDay = rawDay || excelDateToDay(dateNum);
      }
    }
    if (rawDay) {
      currentDay = rawDay;
    }

    if (!task && !jiraId && effort === 0) continue;

    const lowerTask = task.toLowerCase();
    if (
      effort === 0 &&
      (lowerTask === "weekend off" ||
        lowerTask === "holiday" ||
        lowerTask.includes("holiday"))
    ) {
      continue;
    }

    entries.push({
      name,
      month,
      date: currentDate,
      day: currentDay,
      jiraId,
      task,
      effort,
      status: normalizeStatus(status),
      sprint,
      jobName: inferJobName(jiraId),
      billing: "Billable",
    });
  }

  return { entries, meta };
}

function inferJobName(jiraId: string): string {
  if (jiraId && jiraId.trim().length > 0) {
    return "Development";
  }
  return "Client Calls";
}

function normalizeStatus(status: string): string {
  const s = status.toUpperCase().trim();
  if (s === "DONE" || s === "DEV-COMPLETE" || s === "PROD") return "Done";
  if (
    s === "INPROGRESS" || s === "IN-PROGRESS" || s === "IN-PRORESS" ||
    s === "IN PROGRESS" || s === "IN-PORGRESS"
  ) return "In Progress";
  if (s === "STAGE") return "Stage";
  if (s === "") return "";
  return status;
}

export function parseTimesheetWorkbook(
  workbook: XLSX.WorkBook
): { entries: TimelogEntry[]; sheetMetas: SheetMeta[] } {
  const allEntries: TimelogEntry[] = [];
  const sheetMetas: SheetMeta[] = [];

  for (const sheetName of workbook.SheetNames) {
    const monthMatch = matchMonthName(sheetName);
    if (!monthMatch) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const headerRow = findHeaderRow(sheet);
    const blocks = detectBlocks(sheet, headerRow);

    if (blocks.length === 0) continue;

    // Determine month from duration cell (col startCol+3, row 2 for first block)
    const firstBlock = blocks[0];
    const durationStr =
      cellString(sheet, 2, firstBlock.startCol + 3) || sheetName;
    const month = getMonthFromDuration(durationStr) || monthMatch;
    const totalWorkingDays = cellNumber(sheet, 3, firstBlock.startCol + 3);

    const users: UserMeta[] = [];

    for (const block of blocks) {
      const { entries, meta } = parseUserBlock(sheet, block, headerRow, month);
      if (meta.name) {
        users.push(meta);
        allEntries.push(...entries);
      }
    }

    sheetMetas.push({
      month,
      duration: durationStr,
      totalWorkingDays,
      users,
    });
  }

  return { entries: allEntries, sheetMetas };
}
