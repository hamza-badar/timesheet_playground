import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Download,
  Copy,
  Trash2,
  Pencil,
  Check,
  Bell,
} from "lucide-react";
import dayjs from "dayjs";
import {
  ALERT_PRIORITIES,
  buildAlertGroups,
  formatAlertTitle,
  loadAlertFeed,
  newAlertId,
  saveAlertFeed,
  type AlertEntry,
} from "../lib/alertFeed";
import { copyAlertTracking, exportAlertTracking } from "../lib/alertSheetExport";

interface AlertTrackerProps {
  knownNames?: string[];
}

const emptyDraft = (): Omit<AlertEntry, "id"> => ({
  date: dayjs().format("YYYY-MM-DD"),
  onSupport: "",
  priority: "",
  title: "",
  summary: "",
  action: "",
  status: "",
});

export default function AlertTracker({ knownNames = [] }: AlertTrackerProps) {
  const loaded = useMemo(() => loadAlertFeed(), []);
  const [onSupportDefault, setOnSupportDefault] = useState(loaded.onSupport);
  const [rows, setRows] = useState<AlertEntry[]>(loaded.rows);
  const [draft, setDraft] = useState<Omit<AlertEntry, "id">>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const skipSave = useRef(true);

  const allNames = useMemo(() => {
    const set = new Set(
      [...knownNames, onSupportDefault, ...rows.map((r) => r.onSupport)].filter(Boolean)
    );
    return [...set].sort();
  }, [knownNames, onSupportDefault, rows]);

  const knownTitles = useMemo(() => {
    const set = new Set(rows.map((r) => r.title.trim()).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveAlertFeed({ onSupport: onSupportDefault, rows });
  }, [onSupportDefault, rows]);

  const groups = useMemo(() => buildAlertGroups(rows), [rows]);
  const uniqueDays = new Set(rows.map((r) => r.date)).size;

  const resetVariableFields = () => {
    setDraft((prev) => ({
      ...prev,
      priority: "",
      title: "",
      summary: "",
      action: "",
      status: "",
    }));
    setEditingId(null);
    titleRef.current?.focus();
  };

  const handleAdd = () => {
    if (!draft.date || !draft.onSupport.trim() || !draft.title.trim()) return;
    const next: AlertEntry = {
      id: editingId || newAlertId(),
      date: draft.date,
      onSupport: draft.onSupport.trim(),
      priority: draft.priority.trim(),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      action: draft.action.trim(),
      status: draft.status.trim(),
    };
    setOnSupportDefault(next.onSupport);
    setRows((prev) => {
      if (editingId) return prev.map((r) => (r.id === editingId ? next : r));
      return [...prev, next];
    });
    resetVariableFields();
  };

  const handleEdit = (row: AlertEntry) => {
    setEditingId(row.id);
    setDraft({
      date: row.date,
      onSupport: row.onSupport,
      priority: row.priority,
      title: row.title,
      summary: row.summary,
      action: row.action,
      status: row.status,
    });
    titleRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) resetVariableFields();
  };

  const handleExport = async () => {
    if (rows.length === 0) return;
    setExporting(true);
    try {
      await exportAlertTracking({ rows });
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    if (rows.length === 0) return;
    try {
      await copyAlertTracking(rows);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      window.alert("Could not copy. Use Export sheet instead, or allow clipboard access.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-2">
              Prosper support
            </p>
            <h2 className="display-title text-2xl sm:text-3xl text-ink flex items-center gap-2">
              <Bell className="w-6 h-6 text-accent" />
              Daily Alert Tracking
            </h2>
            <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">
              Log alerts for a support day. Same date and person merge into one serial,
              with numbered actions in the last column. Copy or export to match the
              Prosper Daily Alert Tracking sheet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 justify-end">
            <button
              onClick={handleCopy}
              disabled={rows.length === 0}
              className="btn-secondary"
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy for Excel"}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || rows.length === 0}
              className="btn-primary"
            >
              <Download className="w-4 h-4" />
              {exporting ? "Exporting…" : "Export sheet"}
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="display-title text-lg text-ink">
            {editingId ? "Edit alert" : "Add alert"}
          </h3>
          {editingId && (
            <button type="button" onClick={resetVariableFields} className="text-xs font-medium text-muted hover:text-ink">
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="field-label">Date</label>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
              className="field-input"
            />
          </div>
          <div className="md:col-span-5">
            <label className="field-label">On Support</label>
            <input
              list="alert-on-support-names"
              value={draft.onSupport}
              onChange={(e) => setDraft((p) => ({ ...p, onSupport: e.target.value }))}
              placeholder="Hamza"
              className="field-input"
            />
            <datalist id="alert-on-support-names">
              {allNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-4">
            <label className="field-label">Priority</label>
            <select
              value={draft.priority}
              onChange={(e) => setDraft((p) => ({ ...p, priority: e.target.value }))}
              className="field-input"
            >
              {ALERT_PRIORITIES.map((p) => (
                <option key={p || "none"} value={p}>
                  {p || "None"}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-12">
            <label className="field-label">Alert</label>
            <input
              ref={titleRef}
              list="alert-title-options"
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="workflow-wellsfargo-etl-achpayments… or HIGH APDEX Alerts"
              className="field-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <datalist id="alert-title-options">
              {knownTitles.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-12">
            <label className="field-label">Summary</label>
            <textarea
              value={draft.summary}
              onChange={(e) => setDraft((p) => ({ ...p, summary: e.target.value }))}
              placeholder="What happened / root cause"
              rows={2}
              className="field-input min-h-[64px] resize-y"
            />
          </div>
          <div className="md:col-span-12">
            <label className="field-label">Action</label>
            <textarea
              value={draft.action}
              onChange={(e) => setDraft((p) => ({ ...p, action: e.target.value }))}
              placeholder="What you did"
              rows={2}
              className="field-input min-h-[64px] resize-y"
            />
          </div>
          <div className="md:col-span-11">
            <label className="field-label">Status</label>
            <input
              value={draft.status}
              onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}
              placeholder="Waiting on WF files, ticket open, …"
              className="field-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <button
              onClick={handleAdd}
              disabled={!draft.date || !draft.onSupport.trim() || !draft.title.trim()}
              title="Add alert and keep date / on-support"
              className="btn-primary w-full !rounded-xl h-[42px]"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-faint">
          Plus keeps date and on-support. Alerts on the same day for the same person share
          one S. No. and are numbered [1], [2], [3] in the action column.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Alerts" value={rows.length} />
        <Stat label="Days" value={uniqueDays} />
        <Stat label="Groups" value={groups.length} />
      </div>

      <div className="panel overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
          <h3 className="display-title text-lg text-ink">Sheet preview</h3>
          {rows.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Clear all saved alerts?")) {
                  setRows([]);
                }
              }}
              className="text-xs font-medium text-danger hover:text-ink"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#1F4E79] text-white">
                {["S. No.", "Date", "On Support", "Alert(s) Action", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((group) =>
                group.alerts.map((alert, i) => {
                  const isLast = i === group.alerts.length - 1;
                  return (
                    <tr
                      key={alert.id}
                      className={`border-t border-line sheet-row-work ${
                        isLast ? "border-b-2 border-b-ink/35" : ""
                      }`}
                    >
                      {i === 0 && (
                        <>
                          <td
                            rowSpan={group.alerts.length}
                            className="px-3 py-2 text-center align-middle font-medium text-ink"
                          >
                            {group.serial}
                          </td>
                          <td
                            rowSpan={group.alerts.length}
                            className="px-3 py-2 whitespace-nowrap text-center align-middle text-ink"
                          >
                            {dayjs(group.date).format("D-MMM-YY")}
                          </td>
                          <td
                            rowSpan={group.alerts.length}
                            className="px-3 py-2 text-center align-middle text-ink"
                          >
                            {group.onSupport}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2 max-w-[520px] whitespace-pre-wrap text-ink align-top leading-relaxed">
                        <AlertActionPreview index={i + 1} alert={alert} />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap align-top">
                        <span className="inline-flex gap-1">
                          <button
                            onClick={() => handleEdit(alert)}
                            className="p-1 text-muted hover:text-accent"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(alert.id)}
                            className="p-1 text-muted hover:text-danger"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="text-center text-sm text-muted py-8">
            No alerts yet. Add the first one for today&apos;s support shift.
          </p>
        )}
      </div>
    </div>
  );
}

function AlertActionPreview({ index, alert }: { index: number; alert: AlertEntry }) {
  return (
    <div className="space-y-0.5">
      <p className="font-semibold">{formatAlertTitle(index, alert)}</p>
      {alert.summary.trim() ? (
        <p>
          <span className="font-semibold">Summary: </span>
          {alert.summary.trim()}
        </p>
      ) : null}
      {alert.action.trim() ? (
        <p>
          <span className="font-semibold">Action:</span> {alert.action.trim()}
        </p>
      ) : null}
      {alert.status.trim() ? (
        <p>
          <span className="font-semibold">Status: </span>
          {alert.status.trim()}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">{label}</p>
      <p className="display-title text-2xl text-ink mt-1">{value}</p>
    </div>
  );
}
