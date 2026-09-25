import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import {
  ALERT_HEADERS,
  buildAlertGroups,
  formatAlertPlainText,
  formatAlertTitle,
  type AlertEntry,
} from "./alertFeed";

const HEADER_NAVY = "FF1F4E79";
const WHITE = "FFFFFFFF";
const BLACK = "FF000000";
const BORDER_GRAY = "FF505050";

const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: BLACK } };
const MEDIUM: Partial<ExcelJS.Border> = { style: "medium", color: { argb: BORDER_GRAY } };

const BOLD_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 11,
  color: { argb: BLACK },
  name: "Aptos Narrow",
};

const NORMAL_FONT: Partial<ExcelJS.Font> = {
  bold: false,
  size: 11,
  color: { argb: BLACK },
  name: "Aptos Narrow",
};

function side(s: "thin" | "medium" | "none") {
  if (s === "none") return undefined;
  return s === "medium" ? MEDIUM : THIN;
}

function alertRichText(index: number, alert: AlertEntry): ExcelJS.CellValue {
  const runs: ExcelJS.RichText[] = [];
  const title = formatAlertTitle(index, alert);
  const summary = alert.summary.trim();
  const action = alert.action.trim();
  const status = alert.status.trim();

  if (summary) {
    runs.push({ font: BOLD_FONT, text: `${title}\nSummary: ` });
    runs.push({ font: NORMAL_FONT, text: summary });
  } else {
    runs.push({ font: BOLD_FONT, text: title });
  }

  if (action) {
    runs.push({ font: BOLD_FONT, text: `${runs.length ? "\n" : ""}Action:` });
    runs.push({ font: NORMAL_FONT, text: ` ${action}` });
  }

  if (status) {
    runs.push({ font: BOLD_FONT, text: "\nStatus: " });
    runs.push({ font: NORMAL_FONT, text: status });
  }

  return { richText: runs };
}

function estimateRowHeight(text: string): number {
  const lines = text.split("\n");
  let wrapped = 0;
  for (const line of lines) {
    wrapped += Math.max(1, Math.ceil(line.length / 92));
  }
  return Math.max(22, Math.min(180, 16 + wrapped * 14));
}

export async function exportAlertTracking(opts: {
  rows: AlertEntry[];
}): Promise<void> {
  const groups = buildAlertGroups(opts.rows);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily Alert Tracking");

  sheet.columns = [
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 96 },
  ];

  const header = sheet.getRow(1);
  header.height = 31.5;
  ALERT_HEADERS.forEach((label, idx) => {
    const cell = header.getCell(idx + 1);
    cell.value = label;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_NAVY },
    };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      left: THIN,
      right: THIN,
      top: THIN,
      bottom: THIN,
    };
  });

  let excelRow = 2;
  for (const group of groups) {
    const start = excelRow;
    const end = excelRow + group.alerts.length - 1;
    const dateValue = group.date ? dayjs(group.date).toDate() : null;

    group.alerts.forEach((alert, i) => {
      const row = sheet.getRow(excelRow);
      const isFirst = i === 0;
      const isLast = i === group.alerts.length - 1;
      const plain = formatAlertPlainText(i + 1, alert);
      row.height = estimateRowHeight(plain);

      const meta = [group.serial, dateValue, group.onSupport] as const;
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c);
        if (isFirst) cell.value = meta[c - 1];
        if (c === 2) cell.numFmt = "d-mmm-yy";
        cell.font = { name: "Aptos Narrow", size: 11, color: { argb: BLACK } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          left: side(c === 1 ? "medium" : "thin"),
          right: THIN,
          top: side(isFirst ? "medium" : "thin"),
          bottom: side(isLast ? "medium" : "thin"),
        };
      }

      const actionCell = row.getCell(4);
      actionCell.value = alertRichText(i + 1, alert);
      actionCell.font = { name: "Aptos Narrow", size: 11, color: { argb: BLACK } };
      actionCell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
      actionCell.border = {
        left: THIN,
        right: MEDIUM,
        top: side(isFirst ? "medium" : "thin"),
        bottom: side(isLast ? "medium" : "thin"),
      };

      excelRow += 1;
    });

    if (end > start) {
      sheet.mergeCells(start, 1, end, 1);
      sheet.mergeCells(start, 2, end, 2);
      sheet.mergeCells(start, 3, end, 3);
      sheet.getCell(start, 1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      sheet.getCell(start, 2).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      sheet.getCell(start, 3).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const stamp = dayjs().format("YYYYMMDD_HHmmss");
  saveAs(blob, `Daily_Alert_Tracking_${stamp}.xlsx`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function alertHtml(index: number, alert: AlertEntry): string {
  const title = escapeHtml(formatAlertTitle(index, alert));
  const parts: string[] = [`<b>${title}</b>`];
  if (alert.summary.trim()) {
    parts.push(`<b>Summary: </b>${escapeHtml(alert.summary.trim())}`);
  }
  if (alert.action.trim()) {
    parts.push(`<b>Action:</b> ${escapeHtml(alert.action.trim())}`);
  }
  if (alert.status.trim()) {
    parts.push(`<b>Status: </b>${escapeHtml(alert.status.trim())}`);
  }
  return parts.join("<br>");
}

export function alertTrackingHtml(rows: AlertEntry[]): { html: string; tsv: string } {
  const groups = buildAlertGroups(rows);
  const body: string[] = [];
  const tsvLines: string[] = [];
  const cell = (extra = "") =>
    `border:1px solid #000;padding:6px 8px;font-family:Aptos Narrow,Calibri,sans-serif;font-size:11px;${extra}`;

  for (const group of groups) {
    const dateLabel = group.date ? dayjs(group.date).format("D-MMM-YY") : "";
    group.alerts.forEach((alert, i) => {
      tsvLines.push(
        [
          String(group.serial),
          dateLabel,
          group.onSupport,
          formatAlertPlainText(i + 1, alert).replace(/\n/g, " / "),
        ].join("\t")
      );

      const meta =
        i === 0
          ? `<td rowspan="${group.alerts.length}" style="${cell("text-align:center;vertical-align:middle")}">${group.serial}</td><td rowspan="${group.alerts.length}" style="${cell("text-align:center;vertical-align:middle")}">${dateLabel}</td><td rowspan="${group.alerts.length}" style="${cell("text-align:center;vertical-align:middle")}">${escapeHtml(group.onSupport)}</td>`
          : "";

      body.push(
        `<tr>${meta}<td style="${cell("text-align:left;vertical-align:top")}">${alertHtml(i + 1, alert)}</td></tr>`
      );
    });
  }

  const html = `<table cellspacing="0" cellpadding="0"><tbody>${body.join("")}</tbody></table>`;
  return { html, tsv: tsvLines.join("\n") };
}

export async function copyAlertTracking(
  rows: AlertEntry[],
  dates?: string[]
): Promise<void> {
  const source = dates
    ? rows.filter((row) => dates.includes(row.date))
    : rows;
  const { html, tsv } = alertTrackingHtml(source);
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
