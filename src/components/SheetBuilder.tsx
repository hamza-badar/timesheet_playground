import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Download,
  Copy,
  Trash2,
  Pencil,
  Check,
  CalendarDays,
} from "lucide-react";
import dayjs from "dayjs";
import {
  SHEET_STATUSES,
  buildMonthRows,
  isLeaveTask,
  loadFeed,
  loadLastFeedHint,
  newRowId,
  saveFeed,
  type SheetFeedRow,
} from "../lib/sheetFeed";
import { copyProsperBlock, exportProsperBlock } from "../lib/prosperSheetExport";

interface SheetBuilderProps {
  knownNames?: string[];
}

export default function SheetBuilder({ knownNames = [] }: SheetBuilderProps) {
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
  const [status, setStatus] = useState("IN-PROGRESS");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const jiraRef = useRef<HTMLInputElement>(null);
  const skipSave = useRef(true);

  const allNames = useMemo(() => {
    const set = new Set([...knownNames, ...hint.knownNames, personName].filter(Boolean));
    return [...set].sort();
  }, [knownNames, hint.knownNames, personName]);

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
    setStatus(row.status || "IN-PROGRESS");
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
              per ticket if you work across teams. Drafts save in this browser — export or
              copy at month end and paste onto row 8 of the real timesheet.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleCopy} className="btn-secondary">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy for Excel"}
            </button>
            <button onClick={handleExport} disabled={exporting} className="btn-primary">
              <Download className="w-4 h-4" />
              {exporting ? "Exporting…" : "Export sheet"}
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

      <div className="panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="display-title text-xl text-ink">
            {editingId ? "Edit line" : "Add line"}
          </h3>
          <p className="text-xs text-muted">
            {date ? `${dayjs(date).format("ddd D MMM")} · ${dayHours}h logged` : "Pick a date"}
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
                <option key={s} value={s}>
                  {s}
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
          Plus keeps date and status. Change sprint per ticket when needed. Jira, task, and hours clear for the next line.
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
                return (
                  <tr
                    key={`${row.dateIso}-${idx}`}
                    className={`border-t border-line ${rowClass}`}
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
