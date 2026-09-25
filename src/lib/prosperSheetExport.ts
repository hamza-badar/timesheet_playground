import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import {
  FEED_HEADERS,
  buildMonthRows,
  type SheetFeedRow,
  type BuiltSheetRow,
} from "./sheetFeed";

const NAVY = "FF153D64";
const WHITE = "FFFFFFFF";
const BLACK = "FF000000";
const WEEKEND = "FFBFBFBF";
const LEAVE = "FFFFFF00";
const WORK = "FFFFFFFF";

const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: BLACK } };
const MEDIUM: Partial<ExcelJS.Border> = { style: "medium", color: { argb: BLACK } };

function fillArgb(kind: BuiltSheetRow["kind"]): string {
  if (kind === "weekend") return WEEKEND;
  if (kind === "leave") return LEAVE;
  return WORK;
}

function paintCell(
  cell: ExcelJS.Cell,
  opts: {
    value: string | number | Date | null;
    fillArgb: string;
    isDate?: boolean;
    wrap?: boolean;
    left: "thin" | "medium" | "none";
    right: "thin" | "medium" | "none";
    top: "thin" | "medium" | "none";
    bottom: "thin" | "medium" | "none";
    header?: boolean;
  }
) {
  if (opts.isDate && opts.value instanceof Date) {
    cell.value = opts.value;
    cell.numFmt = "d-mmm-yy";
  } else if (opts.value !== null && opts.value !== "") {
    cell.value = opts.value;
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: opts.fillArgb },
  };
  cell.font = opts.header
    ? { name: "Aptos Narrow", size: 11, bold: true, color: { argb: WHITE } }
    : { name: "Aptos Narrow", size: 11, color: { argb: BLACK } };
  cell.alignment = {
    vertical: "middle",
    horizontal: opts.wrap ? "left" : "center",
    wrapText: !!opts.wrap,
  };

  const side = (s: "thin" | "medium" | "none") => {
    if (s === "none") return undefined;
    return s === "medium" ? MEDIUM : THIN;
  };
  cell.border = {
    left: side(opts.left),
    right: side(opts.right),
    top: side(opts.top),
    bottom: side(opts.bottom),
  };
}

export async function exportProsperBlock(opts: {
  personName: string;
  year: number;
  month: number;
  rows: SheetFeedRow[];
}): Promise<void> {
  const built = buildMonthRows(opts.year, opts.month, opts.rows);
  const workbook = new ExcelJS.Workbook();
  const monthLabel = dayjs(
    `${opts.year}-${String(opts.month).padStart(2, "0")}-01`
  ).format("MMM YYYY");
  const sheetName = `${(opts.personName || "Timesheet").split(" ")[0]} ${monthLabel}`.slice(
    0,
    31
  );
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 90 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 10 },
  ];

  const header = sheet.getRow(1);
  header.height = 20;
  FEED_HEADERS.forEach((label, idx) => {
    paintCell(header.getCell(idx + 1), {
      value: label,
      fillArgb: NAVY,
      header: true,
      left: idx === 0 ? "medium" : "thin",
      right: idx === 7 ? "medium" : "thin",
      top: "medium",
      bottom: "medium",
    });
  });

  built.forEach((row, i) => {
    const excelRow = i + 2;
    const isLast = i === built.length - 1;
    const dayEnd =
      isLast || built[i + 1].dateIso !== row.dateIso;
    const values: (string | number | Date | null)[] = [
      row.date ? dayjs(row.date).toDate() : null,
      row.day,
      row.jiraId,
      row.task,
      row.effort === "" ? null : row.effort,
      null,
      row.status,
      row.sprint,
    ];

    for (let c = 1; c <= 8; c++) {
      paintCell(sheet.getCell(excelRow, c), {
        value: values[c - 1],
        fillArgb: fillArgb(row.kind),
        isDate: c === 1,
        wrap: c === 4,
        left: c === 1 ? "medium" : "thin",
        right: c === 8 ? "medium" : "thin",
        top: "thin",
        bottom: isLast || dayEnd ? "medium" : "thin",
      });
    }

    if (row.mergeCount > 1) {
      sheet.mergeCells(excelRow, 1, excelRow + row.mergeCount - 1, 1);
      sheet.mergeCells(excelRow, 2, excelRow + row.mergeCount - 1, 2);
      sheet.getCell(excelRow, 1).alignment = { horizontal: "center", vertical: "middle" };
      sheet.getCell(excelRow, 2).alignment = { horizontal: "center", vertical: "middle" };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const person = (opts.personName || "Person").replace(/\s+/g, "_");
  const fileMonth = dayjs(
    `${opts.year}-${String(opts.month).padStart(2, "0")}-01`
  ).format("YYYY_MM");
  saveAs(blob, `Prosper_Feed_${person}_${fileMonth}.xlsx`);
}

function excelDateLabel(iso: string): string {
  return dayjs(iso).format("D-MMM-YY");
}

function rowBg(kind: BuiltSheetRow["kind"]): string {
  if (kind === "weekend") return "#BFBFBF";
  if (kind === "leave") return "#FFFF00";
  return "#FFFFFF";
}

export function prosperBlockHtml(opts: {
  year: number;
  month: number;
  rows: SheetFeedRow[];
  dates?: string[];
}): { html: string; tsv: string } {
  let built = buildMonthRows(opts.year, opts.month, opts.rows);
  const includeHeader = !opts.dates;
  if (opts.dates) {
    const wanted = new Set(opts.dates);
    built = built.filter((row) => wanted.has(row.dateIso));
  }
  const cellStyle = (kind: BuiltSheetRow["kind"], extra = "") =>
    `border:1px solid #000;padding:4px 8px;font-family:Calibri,Aptos Narrow,sans-serif;font-size:11px;background:${rowBg(kind)};${extra}`;

  const headerCells = FEED_HEADERS.map(
    (h) =>
      `<th style="border:1px solid #000;padding:4px 8px;background:#153D64;color:#fff;font-weight:bold;font-size:11px">${h}</th>`
  ).join("");

  const body: string[] = [];
  const tsvLines: string[] = includeHeader ? [FEED_HEADERS.join("\t")] : [];

  for (const row of built) {
    tsvLines.push(
      [
        row.date ? excelDateLabel(row.date) : "",
        row.day || "",
        row.jiraId,
        row.task,
        row.effort === "" ? "" : String(row.effort),
        "",
        row.status,
        row.sprint,
      ].join("\t")
    );

    const dateCell =
      row.mergeCount >= 1 && row.date
        ? `<td rowspan="${row.mergeCount}" style="${cellStyle(row.kind, "text-align:center;vertical-align:middle")}">${excelDateLabel(row.date)}</td><td rowspan="${row.mergeCount}" style="${cellStyle(row.kind, "text-align:center;vertical-align:middle")}">${row.day}</td>`
        : "";

    body.push(
      `<tr>${dateCell}<td style="${cellStyle(row.kind)}">${escapeHtml(row.jiraId)}</td><td style="${cellStyle(row.kind, "text-align:left")}">${escapeHtml(row.task)}</td><td style="${cellStyle(row.kind, "text-align:center")}">${row.effort}</td><td style="${cellStyle(row.kind)}"></td><td style="${cellStyle(row.kind, "text-align:center")}">${escapeHtml(row.status)}</td><td style="${cellStyle(row.kind, "text-align:center")}">${escapeHtml(row.sprint)}</td></tr>`
    );
  }

  const html = includeHeader
    ? `<table cellspacing="0" cellpadding="0"><thead><tr>${headerCells}</tr></thead><tbody>${body.join("")}</tbody></table>`
    : `<table cellspacing="0" cellpadding="0"><tbody>${body.join("")}</tbody></table>`;
  return { html, tsv: tsvLines.join("\n") };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function copyProsperBlock(opts: {
  year: number;
  month: number;
  rows: SheetFeedRow[];
  dates?: string[];
}): Promise<void> {
  const { html, tsv } = prosperBlockHtml(opts);
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([tsv], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(tsv);
}
