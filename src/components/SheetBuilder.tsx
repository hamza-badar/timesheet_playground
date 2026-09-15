import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Download,
  Copy,
  Trash2,
  Pencil,
  Check,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  UserRound,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import {
  SHEET_STATUSES,
  JOB_NAME_OPTIONS,
  DEFAULT_NO_JIRA_JOB_NAME,
  buildMonthRows,
  isExportableFeedRow,
  isLeaveTask,
  loadFeed,
  loadLastFeedHint,
  newRowId,
  saveFeed,
  sheetFeedToTimelogEntries,
  type SheetFeedRow,
} from "../lib/sheetFeed";
import { copyProsperBlock, exportProsperBlock } from "../lib/prosperSheetExport";
import { exportTimelogs } from "../lib/exporter";
import type { MemberConfig } from "../lib/types";
import SprintSummary from "./SprintSummary";

interface SheetBuilderProps {
  knownNames?: string[];
  memberConfigs?: MemberConfig[];
  onConfigsChange?: (configs: MemberConfig[]) => void;
}

function resolveMemberConfig(
  personName: string,
  configs: MemberConfig[]
): MemberConfig {
  const name = personName.trim();
  const found = configs.find((c) => c.name === name);
  if (found) return found;
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    name,
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
    employeeId: "",
    email: "",
    clientName: "",
    projectName: "Prosper",
  };
}

function emptyMemberConfig(name: string): MemberConfig {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    name: name.trim(),
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
    employeeId: "",
    email: "",
    clientName: "",
    projectName: "Prosper",
  };
}

export default function SheetBuilder({
  knownNames = [],
  memberConfigs = [],
  onConfigsChange,
}: SheetBuilderProps) {
  const hint = useMemo(() => loadLastFeedHint(), []);
  const [personName, setPersonName] = useState(hint.personName);
  const [year, setYear] = useState(hint.year);
  const [month, setMonth] = useState(hint.month);
  const [rows, setRows] = useState<SheetFeedRow[]>(() =>
    loadFeed(hint.personName, hint.year, hint.month).rows
  );

  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [sprint, setSprint] = useState("");
  const [jiraId, setJiraId] = useState("");
  const [task, setTask] = useState("");
  const [effort, setEffort] = useState("");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingZoho, setExportingZoho] = useState(false);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [addingNewPerson, setAddingNewPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");
  const [newPersonEmployeeId, setNewPersonEmployeeId] = useState("");
  const [jobNamePickerOpen, setJobNamePickerOpen] = useState(false);
  const [jobNameDrafts, setJobNameDrafts] = useState<Record<string, string>>({});
  const [pendingZoho, setPendingZoho] = useState<{
    name: string;
    configs: MemberConfig[];
  } | null>(null);
  const [builderTab, setBuilderTab] = useState<"lines" | "summary">("lines");
  const jiraRef = useRef<HTMLInputElement>(null);
  const skipSave = useRef(true);

  const allNames = useMemo(() => {
    const set = new Set([...knownNames, ...hint.knownNames, personName].filter(Boolean));
    return [...set].sort();
  }, [knownNames, hint.knownNames, personName]);

  const configuredMembers = useMemo(
    () =>
      [...memberConfigs]
        .filter((c) => c.name.trim())
        .sort((a, b) => a.name.localeCompare(b.name)),
    [memberConfigs]
  );

  useEffect(() => {
    skipSave.current = true;
    const loaded = loadFeed(personName, year, month);
    setRows(loaded.rows);
    setEditingId(null);
  }, [personName, year, month]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveFeed({ personName, year, month, rows });
  }, [personName, year, month, rows]);

  const monthValue = `${year}-${String(month).padStart(2, "0")}`;
  const monthDays = dayjs(monthValue + "-01").daysInMonth();
  const built = useMemo(() => buildMonthRows(year, month, rows), [year, month, rows]);
  const totalHours = rows.reduce((sum, r) => sum + (r.effort || 0), 0);

  const hoursByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.date, (map.get(r.date) || 0) + (r.effort || 0));
    }
    return map;
  }, [rows]);

  const dayHours = date ? hoursByDate.get(date) || 0 : 0;

  const exportableRowCount = useMemo(
    () => rows.filter(isExportableFeedRow).length,
    [rows]
  );

  const summaryEntries = useMemo(
    () => sheetFeedToTimelogEntries(personName.trim() || "Unnamed", rows),
    [personName, rows]
  );

  const noJiraExportRows = useMemo(
    () => rows.filter((r) => isExportableFeedRow(r) && !r.jiraId.trim()),
    [rows]
  );

  const resetVariableFields = () => {
    setJiraId("");
    setTask("");
    setEffort("");
    setEditingId(null);
    jiraRef.current?.focus();
  };

  const handleAdd = () => {
    if (!date || !task.trim()) return;
    const next: SheetFeedRow = {
      id: editingId || newRowId(),
      date,
      jiraId: jiraId.trim(),
      task: task.trim(),
      effort: parseFloat(effort) || 0,
      status,
      sprint: sprint.trim(),
    };

    setRows((prev) => {
      if (editingId) {
        return prev.map((r) => (r.id === editingId ? next : r));
      }
      return [...prev, next].sort((a, b) => a.date.localeCompare(b.date));
    });
    resetVariableFields();
  };

  const handleEdit = (row: SheetFeedRow) => {
    setEditingId(row.id);
    setDate(row.date);
    setSprint(row.sprint);
    setJiraId(row.jiraId);
    setTask(row.task);
    setEffort(row.effort ? String(row.effort) : "");
    setStatus(row.status || "");
    jiraRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) resetVariableFields();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportProsperBlock({ personName, year, month, rows });
    } finally {
      setExporting(false);
    }
  };

  const runZohoExport = (
    name: string,
    configs: MemberConfig[],
    sourceRows: SheetFeedRow[]
  ) => {
    const entries = sheetFeedToTimelogEntries(name, sourceRows);
    if (entries.length === 0) return;

    setExportingZoho(true);
    try {
      const memberPart = name.trim().replace(/\s+/g, "_") || "All";
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `Timelogs_${memberPart}_${datePart}.xlsx`;
      const config = resolveMemberConfig(name, configs);
      exportTimelogs(entries, [config], filename);
    } finally {
      setExportingZoho(false);
    }
  };

  const openJobNamePicker = (name: string, configs: MemberConfig[], sourceRows: SheetFeedRow[]) => {
    const drafts: Record<string, string> = {};
    for (const row of sourceRows) {
      if (!isExportableFeedRow(row) || row.jiraId.trim()) continue;
      drafts[row.id] = row.jobName?.trim() || DEFAULT_NO_JIRA_JOB_NAME;
    }
    setJobNameDrafts(drafts);
    setPendingZoho({ name, configs });
    setJobNamePickerOpen(true);
  };

  const beginZohoExport = (name: string, configs: MemberConfig[], sourceRows: SheetFeedRow[]) => {
    const needsJobNames = sourceRows.some(
      (r) => isExportableFeedRow(r) && !r.jiraId.trim()
    );
    if (needsJobNames) {
      openJobNamePicker(name, configs, sourceRows);
      return;
    }
    runZohoExport(name, configs, sourceRows);
  };

  const assignPersonFromPicker = (name: string, configs: MemberConfig[]) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Keep current draft lines under the chosen person before switching.
    saveFeed({ personName: trimmed, year, month, rows });
    skipSave.current = true;
    setPersonName(trimmed);
    setPersonPickerOpen(false);
    setAddingNewPerson(false);
    setNewPersonName("");
    setNewPersonEmail("");
    setNewPersonEmployeeId("");
    beginZohoExport(trimmed, configs, rows);
  };

  const closePersonPicker = () => {
    setPersonPickerOpen(false);
    setAddingNewPerson(false);
    setNewPersonName("");
    setNewPersonEmail("");
    setNewPersonEmployeeId("");
  };

  const closeJobNamePicker = () => {
    setJobNamePickerOpen(false);
    setPendingZoho(null);
    setJobNameDrafts({});
  };

  const handleConfirmJobNamesAndExport = () => {
    if (!pendingZoho) return;
    const nextRows = rows.map((row) => {
      if (!(row.id in jobNameDrafts)) return row;
      return { ...row, jobName: jobNameDrafts[row.id] };
    });
    setRows(nextRows);
    const { name, configs } = pendingZoho;
    closeJobNamePicker();
    runZohoExport(name, configs, nextRows);
  };

  const handleExportZoho = () => {
    if (exportableRowCount === 0) return;
    if (!personName.trim()) {
      setAddingNewPerson(configuredMembers.length === 0);
      setPersonPickerOpen(true);
      return;
    }
    beginZohoExport(personName, memberConfigs, rows);
  };

  const handleSelectConfiguredPerson = (name: string) => {
    assignPersonFromPicker(name, memberConfigs);
  };

  const handleAddNewPersonAndExport = () => {
    const trimmed = newPersonName.trim();
    if (!trimmed) return;

    const nextConfig: MemberConfig = {
      ...emptyMemberConfig(trimmed),
      employeeId: newPersonEmployeeId.trim(),
      email: newPersonEmail.trim(),
    };
    const withoutDup = memberConfigs.filter((c) => c.name !== trimmed);
    const nextConfigs = [...withoutDup, nextConfig].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    onConfigsChange?.(nextConfigs);
    assignPersonFromPicker(trimmed, nextConfigs);
  };

  const handleCopy = async () => {
    await copyProsperBlock({ year, month, rows });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-2">
              Prosper workflow
            </p>
            <h2 className="display-title text-2xl sm:text-3xl text-ink flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-accent" />
              Sheet builder
            </h2>
            <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">
              Add lines through the month. Date stays put when you press plus; set sprint
              per ticket if you work across teams. Drafts save in this browser — export the
              Prosper sheet to paste onto row 8, or export Zoho Timelogs directly and skip
              the converter step.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 justify-end">
            <button onClick={handleCopy} className="btn-secondary">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy for Excel"}
            </button>
            <button onClick={handleExport} disabled={exporting} className="btn-secondary">
              <Download className="w-4 h-4" />
              {exporting ? "Exporting…" : "Export sheet"}
            </button>
            <button
              onClick={handleExportZoho}
              disabled={exportingZoho || exportableRowCount === 0}
              className="btn-primary"
              title={
                exportableRowCount === 0
                  ? "Add non-leave work lines to export Zoho Timelogs"
                  : "Export Zoho Timelogs (same format as Converter → Export Timelogs)"
              }
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exportingZoho ? "Exporting…" : "Export Zoho Sheet"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Person</label>
            <input
              list="sheet-builder-names"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="e.g. Hamza Badar"
              className="field-input"
            />
            <datalist id="sheet-builder-names">
              {allNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="field-label">Month</label>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                setYear(y);
                setMonth(m);
              }}
              className="field-input"
            />
          </div>
        </div>
      </div>

      {personPickerOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
          onClick={closePersonPicker}
        >
          <div
            className="panel w-full max-w-md p-5 sm:p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="zoho-person-picker-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-1">
                  Zoho export
                </p>
                <h3
                  id="zoho-person-picker-title"
                  className="display-title text-xl text-ink flex items-center gap-2"
                >
                  <UserRound className="w-5 h-5 text-accent" />
                  Choose a person
                </h3>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">
                  Person is empty. Pick someone from Team Member Configuration, or add a
                  new member if none match.
                </p>
              </div>
              <button
                onClick={closePersonPicker}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!addingNewPerson && (
              <div className="space-y-3">
                {configuredMembers.length > 0 ? (
                  <ul className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {configuredMembers.map((member) => (
                      <li key={member.name}>
                        <button
                          type="button"
                          onClick={() => handleSelectConfiguredPerson(member.name)}
                          className="w-full text-left rounded-xl border border-line px-3.5 py-3 hover:border-accent hover:bg-accent-soft/40 transition-colors"
                        >
                          <p className="font-semibold text-ink">{member.name}</p>
                          <p className="text-xs text-muted mt-0.5 truncate">
                            {[member.employeeId, member.email].filter(Boolean).join(" · ") ||
                              "No employee details yet"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted rounded-xl border border-dashed border-line px-4 py-6 text-center">
                    No team members configured yet. Add a new person to continue.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setAddingNewPerson(true)}
                  className="btn-secondary w-full"
                >
                  <Plus className="w-4 h-4" />
                  Add new member
                </button>
              </div>
            )}

            {addingNewPerson && (
              <div className="space-y-3">
                <div>
                  <label className="field-label">Full name</label>
                  <input
                    autoFocus
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="e.g. Hamza Badar"
                    className="field-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewPersonAndExport();
                      }
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Employee ID</label>
                    <input
                      value={newPersonEmployeeId}
                      onChange={(e) => setNewPersonEmployeeId(e.target.value)}
                      placeholder="Optional"
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label">Email</label>
                    <input
                      type="email"
                      value={newPersonEmail}
                      onChange={(e) => setNewPersonEmail(e.target.value)}
                      placeholder="Optional"
                      className="field-input"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end pt-1">
                  {configuredMembers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddingNewPerson(false)}
                      className="btn-secondary"
                    >
                      Back to list
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddNewPersonAndExport}
                    disabled={!newPersonName.trim()}
                    className="btn-primary"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Save &amp; export
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {jobNamePickerOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
          onClick={closeJobNamePicker}
        >
          <div
            className="panel w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="zoho-job-name-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-1">
                  Zoho export
                </p>
                <h3
                  id="zoho-job-name-title"
                  className="display-title text-xl text-ink"
                >
                  Set Job Name
                </h3>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">
                  These lines have no Jira ID. Choose a Job Name for each before
                  exporting Timelogs.
                </p>
              </div>
              <button
                onClick={closeJobNamePicker}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ul className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {noJiraExportRows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-line px-3.5 py-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{row.task}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {dayjs(row.date).format("D MMM YYYY")}
                        {row.effort ? ` · ${row.effort}h` : ""}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Job Name</label>
                    <select
                      value={jobNameDrafts[row.id] || DEFAULT_NO_JIRA_JOB_NAME}
                      onChange={(e) =>
                        setJobNameDrafts((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      className="field-input"
                    >
                      {JOB_NAME_OPTIONS.map((job) => (
                        <option key={job} value={job}>
                          {job}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2 justify-end pt-1">
              <button type="button" onClick={closeJobNamePicker} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmJobNamesAndExport}
                className="btn-primary"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Zoho Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="segmented w-fit">
        <button
          onClick={() => setBuilderTab("lines")}
          className={`segmented-item ${builderTab === "lines" ? "segmented-item-active" : ""}`}
        >
          <CalendarDays className="w-4 h-4" />
          Month lines
        </button>
        <button
          onClick={() => setBuilderTab("summary")}
          className={`segmented-item ${builderTab === "summary" ? "segmented-item-active" : ""}`}
        >
          <FileText className="w-4 h-4" />
          Sprint Summary
        </button>
      </div>

      {builderTab === "summary" && <SprintSummary entries={summaryEntries} />}

      {builderTab === "lines" && (
      <>
      <div className="panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="display-title text-xl text-ink">
            {editingId ? "Edit line" : "Add line"}
          </h3>
          <p className="text-xs text-muted">
            {date
              ? `${dayjs(date).format("ddd D MMM")} · ${dayHours}h logged · ${
                  Math.round((8 - dayHours) * 100) / 100
                }h left`
              : "Pick a date"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="field-label">Date</label>
            <input
              type="date"
              value={date}
              min={`${monthValue}-01`}
              max={`${monthValue}-${String(monthDays).padStart(2, "0")}`}
              onChange={(e) => setDate(e.target.value)}
              className="field-input"
            />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Jira ID</label>
            <input
              ref={jiraRef}
              value={jiraId}
              onChange={(e) => setJiraId(e.target.value)}
              placeholder="CLS-9324"
              className="field-input"
            />
          </div>
          <div className="md:col-span-3">
            <label className="field-label">Task</label>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Task, meeting, or SICK LEAVE"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="field-input"
            />
          </div>
          <div className="md:col-span-1">
            <label className="field-label">Hours</label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              className="field-input"
            />
          </div>
          <div className="md:col-span-1">
            <label className="field-label">Sprint</label>
            <input
              value={sprint}
              onChange={(e) => setSprint(e.target.value)}
              placeholder="13"
              className="field-input"
            />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="field-input"
            >
              {SHEET_STATUSES.map((s) => (
                <option key={s.label} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <button
              onClick={handleAdd}
              disabled={!date || !task.trim()}
              title="Add line and keep date/status"
              className="btn-primary w-full !rounded-xl h-[42px]"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-faint">
          Plus keeps date and status. Use None for meetings with no status. Change sprint per ticket when needed. Jira, task, and hours clear for the next line.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Lines" value={rows.length} />
        <Stat label="Hours" value={`${totalHours}h`} />
        <Stat label="Days with work" value={hoursByDate.size} />
        <Stat label="Month days" value={monthDays} />
      </div>

      <div className="panel overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
          <h3 className="display-title text-lg text-ink">Month preview</h3>
          {rows.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Clear all cached lines for this person and month?")) {
                  setRows([]);
                }
              }}
              className="text-xs font-medium text-danger hover:text-ink"
            >
              Clear month
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-accent text-accent-fg">
                {["Date", "Day", "Jira ID", "Task", "Effort", "Working Days", "Status", "Sprint", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {built.map((row, idx) => {
                const source = row.sourceId
                  ? rows.find((r) => r.id === row.sourceId)
                  : undefined;
                const rowClass =
                  row.kind === "weekend"
                    ? "sheet-row-weekend"
                    : row.kind === "leave"
                      ? "sheet-row-leave"
                      : "sheet-row-work";
                const isLastOfDay =
                  idx === built.length - 1 ||
                  built[idx + 1].dateIso !== row.dateIso;
                return (
                  <tr
                    key={`${row.dateIso}-${idx}`}
                    className={`border-t border-line ${
                      isLastOfDay ? "border-b-2 border-b-ink/35" : ""
                    } ${rowClass}`}
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap text-ink">
                      {row.date ? dayjs(row.date).format("D-MMM-YY") : ""}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-ink-soft">{row.day || ""}</td>
                    <td className="px-3 py-1.5">
                      {row.jiraId ? (
                        <span className="inline-block bg-accent text-accent-fg text-xs font-mono font-semibold px-2 py-0.5 rounded-md">
                          {row.jiraId}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 max-w-[360px] text-ink">
                      {row.task}
                      {isLeaveTask(row.task) ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-warn">leave</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-ink-soft">{row.effort}</td>
                    <td className="px-3 py-1.5" />
                    <td className="px-3 py-1.5 whitespace-nowrap text-ink-soft">{row.status}</td>
                    <td className="px-3 py-1.5 text-center text-ink-soft">{row.sprint}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {source && (
                        <span className="inline-flex gap-1">
                          <button
                            onClick={() => handleEdit(source)}
                            className="p-1 text-muted hover:text-accent"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(source.id)}
                            className="p-1 text-muted hover:text-danger"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="text-center text-sm text-muted py-8">
            No lines yet. Weekend rows are still generated so the export matches a full month.
          </p>
        )}
      </div>
      </>
      )}
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
