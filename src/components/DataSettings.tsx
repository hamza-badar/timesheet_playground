import { useRef, useState } from "react";
import {
  Settings,
  Download,
  Upload,
  CalendarPlus,
  Bell,
  Users,
} from "lucide-react";
import type { MemberConfig } from "../lib/types";
import {
  countAlerts,
  countSheetDrafts,
  exportAlertsJson,
  exportSheetBuilderJson,
  exportTeamMembersJson,
  importAlertsJson,
  importSheetBuilderJson,
  parseTeamMembersJson,
} from "../lib/dataBackup";

interface DataSettingsProps {
  memberConfigs: MemberConfig[];
  onImportMembers: (configs: MemberConfig[]) => void;
  onLocalDataImported: () => void;
}

type Notice = { tone: "ok" | "err"; text: string } | null;

export default function DataSettings({
  memberConfigs,
  onImportMembers,
  onLocalDataImported,
}: DataSettingsProps) {
  const [sheetCount, setSheetCount] = useState(() => countSheetDrafts());
  const [alertCount, setAlertCount] = useState(() => countAlerts());
  const [notice, setNotice] = useState<Notice>(null);

  const sheetInput = useRef<HTMLInputElement>(null);
  const alertInput = useRef<HTMLInputElement>(null);
  const teamInput = useRef<HTMLInputElement>(null);

  const flash = (tone: "ok" | "err", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const readFile = (file: File) => file.text();

  const handleSheetImport = async (file: File | undefined) => {
    if (!file) return;
    if (
      !window.confirm(
        "Replace all Sheet builder drafts in this browser with this JSON file?"
      )
    ) {
      return;
    }
    try {
      importSheetBuilderJson(await readFile(file));
      setSheetCount(countSheetDrafts());
      onLocalDataImported();
      flash("ok", "Sheet builder data imported.");
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Could not import sheet builder JSON.");
    }
  };

  const handleAlertImport = async (file: File | undefined) => {
    if (!file) return;
    if (!window.confirm("Replace all Alerts in this browser with this JSON file?")) {
      return;
    }
    try {
      importAlertsJson(await readFile(file));
      setAlertCount(countAlerts());
      onLocalDataImported();
      flash("ok", "Alerts data imported.");
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Could not import alerts JSON.");
    }
  };

  const handleTeamImport = async (file: File | undefined) => {
    if (!file) return;
    if (
      !window.confirm(
        "Replace Team Member Configuration in this browser with this JSON file?"
      )
    ) {
      return;
    }
    try {
      onImportMembers(parseTeamMembersJson(await readFile(file)));
      flash("ok", "Team member configuration imported.");
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Could not import team JSON.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="panel p-5 sm:p-6 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          Backup
        </p>
        <h2 className="display-title text-2xl sm:text-3xl text-ink flex items-center gap-2">
          <Settings className="w-6 h-6 text-accent" />
          Data settings
        </h2>
        <p className="text-sm text-muted max-w-2xl leading-relaxed">
          Export or import JSON separately for Sheet builder, Alerts, and Team
          Member Configuration. Import replaces the matching data in this browser.
        </p>
        {notice && (
          <p
            className={`text-sm font-medium ${
              notice.tone === "ok" ? "text-success" : "text-danger"
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>

      <DataCard
        icon={CalendarPlus}
        title="Sheet builder"
        detail={`${sheetCount} saved month draft${sheetCount === 1 ? "" : "s"}`}
        inputRef={sheetInput}
        onExport={exportSheetBuilderJson}
        onPick={() => sheetInput.current?.click()}
        onFile={(file) => {
          void handleSheetImport(file);
          if (sheetInput.current) sheetInput.current.value = "";
        }}
      />

      <DataCard
        icon={Bell}
        title="Alerts"
        detail={`${alertCount} saved alert${alertCount === 1 ? "" : "s"}`}
        inputRef={alertInput}
        onExport={exportAlertsJson}
        onPick={() => alertInput.current?.click()}
        onFile={(file) => {
          void handleAlertImport(file);
          if (alertInput.current) alertInput.current.value = "";
        }}
      />

      <DataCard
        icon={Users}
        title="Team Member Configuration"
        detail={`${memberConfigs.length} member${memberConfigs.length === 1 ? "" : "s"}`}
        inputRef={teamInput}
        onExport={() => exportTeamMembersJson(memberConfigs)}
        onPick={() => teamInput.current?.click()}
        onFile={(file) => {
          void handleTeamImport(file);
          if (teamInput.current) teamInput.current.value = "";
        }}
      />
    </div>
  );
}

function DataCard({
  icon: Icon,
  title,
  detail,
  inputRef,
  onExport,
  onPick,
  onFile,
}: {
  icon: typeof CalendarPlus;
  title: string;
  detail: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onPick: () => void;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h3 className="display-title text-xl text-ink flex items-center gap-2">
            <Icon className="w-5 h-5 text-accent shrink-0" />
            {title}
          </h3>
          <p className="text-sm text-muted mt-1">{detail}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button type="button" onClick={onExport} className="btn-secondary">
            <Download className="w-4 h-4" />
            Export JSON
          </button>
          <button type="button" onClick={onPick} className="btn-primary">
            <Upload className="w-4 h-4" />
            Import JSON
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
