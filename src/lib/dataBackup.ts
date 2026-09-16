import { saveAs } from "file-saver";
import dayjs from "dayjs";
import type { MemberConfig } from "./types";
import {
  snapshotSheetFeedStore,
  replaceSheetFeedStore,
  type SheetFeedStore,
} from "./sheetFeed";
import {
  snapshotAlertFeed,
  replaceAlertFeed,
  type AlertFeedState,
} from "./alertFeed";

export const BACKUP_KINDS = {
  sheetBuilder: "sheet-builder",
  alerts: "alerts",
  teamMembers: "team-members",
} as const;

export type BackupKind = (typeof BACKUP_KINDS)[keyof typeof BACKUP_KINDS];

interface BackupEnvelope<K extends BackupKind, T> {
  kind: K;
  version: 1;
  exportedAt: string;
  data: T;
}

export type SheetBuilderBackup = BackupEnvelope<typeof BACKUP_KINDS.sheetBuilder, SheetFeedStore>;
export type AlertsBackup = BackupEnvelope<typeof BACKUP_KINDS.alerts, AlertFeedState>;
export type TeamMembersBackup = BackupEnvelope<typeof BACKUP_KINDS.teamMembers, MemberConfig[]>;

function envelope<K extends BackupKind, T>(kind: K, data: T): BackupEnvelope<K, T> {
  return {
    kind,
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  saveAs(blob, filename);
}

function stamp() {
  return dayjs().format("YYYYMMDD_HHmmss");
}

export function exportSheetBuilderJson() {
  downloadJson(
    `sheet_builder_${stamp()}.json`,
    envelope(BACKUP_KINDS.sheetBuilder, snapshotSheetFeedStore())
  );
}

export function exportAlertsJson() {
  downloadJson(`alerts_${stamp()}.json`, envelope(BACKUP_KINDS.alerts, snapshotAlertFeed()));
}

export function exportTeamMembersJson(configs: MemberConfig[]) {
  downloadJson(
    `team_members_${stamp()}.json`,
    envelope(BACKUP_KINDS.teamMembers, configs)
  );
}

function parseJsonFile(text: string): unknown {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("File is not a JSON object");
  }
  return parsed;
}

function unwrap<K extends BackupKind, T>(
  parsed: unknown,
  kind: K,
  asRaw: (value: unknown) => T | null
): T {
  const obj = parsed as { kind?: string; data?: unknown };
  if (obj.kind === kind && obj.data !== undefined) {
    const data = asRaw(obj.data);
    if (!data) throw new Error("Backup data is not valid");
    return data;
  }
  const raw = asRaw(parsed);
  if (raw) return raw;
  throw new Error(`This file is not a ${kind} backup`);
}

function asSheetStore(value: unknown): SheetFeedStore | null {
  if (!value || typeof value !== "object") return null;
  const store = value as Partial<SheetFeedStore>;
  if (!store.drafts || typeof store.drafts !== "object") return null;
  return {
    drafts: store.drafts as SheetFeedStore["drafts"],
    lastKey: typeof store.lastKey === "string" ? store.lastKey : "",
    knownNames: Array.isArray(store.knownNames) ? store.knownNames : [],
  };
}

function asAlertState(value: unknown): AlertFeedState | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<AlertFeedState>;
  if (!Array.isArray(draft.rows)) return null;
  return {
    onSupport: typeof draft.onSupport === "string" ? draft.onSupport : "",
    rows: draft.rows,
  };
}

function asMembers(value: unknown): MemberConfig[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is MemberConfig => {
    return !!item && typeof item === "object" && typeof (item as MemberConfig).name === "string";
  });
}

export function importSheetBuilderJson(text: string) {
  const data = unwrap(parseJsonFile(text), BACKUP_KINDS.sheetBuilder, asSheetStore);
  replaceSheetFeedStore(data);
}

export function importAlertsJson(text: string) {
  const data = unwrap(parseJsonFile(text), BACKUP_KINDS.alerts, asAlertState);
  replaceAlertFeed(data);
}

export function parseTeamMembersJson(text: string): MemberConfig[] {
  return unwrap(parseJsonFile(text), BACKUP_KINDS.teamMembers, asMembers);
}

export function countSheetDrafts(): number {
  return Object.keys(snapshotSheetFeedStore().drafts).length;
}

export function countAlerts(): number {
  return snapshotAlertFeed().rows.length;
}
