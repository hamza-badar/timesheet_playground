import { useState, useMemo } from "react";
import { Plus, Copy, X } from "lucide-react";
import dayjs from "dayjs";
import type { TimelogEntry } from "../lib/types";

interface AddRecordProps {
  memberNames: string[];
  onAddEntries: (entries: TimelogEntry[]) => void;
}

const JOB_NAMES = [
  "Client Calls",
  "Development",
  "Internal Calls",
  "Training",
];

function getMonthFromDate(dateStr: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const d = dayjs(dateStr);
  return d.isValid() ? months[d.month()] : "";
}

export default function AddRecord({ memberNames, onAddEntries }: AddRecordProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(memberNames[0] || "");
  const [dates, setDates] = useState<string[]>([""]);
  const [useRange, setUseRange] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [jiraId, setJiraId] = useState("");
  const [task, setTask] = useState("");
  const [effort, setEffort] = useState("8");
  const [status, setStatus] = useState("Done");
  const [sprint, setSprint] = useState("");
  const [jobName, setJobName] = useState("Development");

  const resolvedDates = useMemo(() => {
    if (!useRange) return dates.filter((d) => d);

    if (!rangeStart || !rangeEnd) return [];
    const result: string[] = [];
    let current = dayjs(rangeStart);
    const end = dayjs(rangeEnd);
    while (current.isBefore(end) || current.isSame(end, "day")) {
      const dow = current.day();
      if (!skipWeekends || (dow !== 0 && dow !== 6)) {
        result.push(current.format("YYYY-MM-DD"));
      }
      current = current.add(1, "day");
    }
    return result;
  }, [dates, useRange, rangeStart, rangeEnd, skipWeekends]);

  const addDateSlot = () => setDates([...dates, ""]);
  const removeDateSlot = (idx: number) =>
    setDates(dates.filter((_, i) => i !== idx));
  const updateDate = (idx: number, val: string) =>
    setDates(dates.map((d, i) => (i === idx ? val : d)));

  const handleSubmit = () => {
    if (resolvedDates.length === 0 || !name) return;

    const newEntries: TimelogEntry[] = resolvedDates.map((dateStr) => ({
      name,
      month: getMonthFromDate(dateStr),
      date: dateStr,
      day: dayjs(dateStr).format("dddd"),
      jiraId,
      task,
      effort: parseFloat(effort) || 0,
      status,
      sprint,
      jobName,
      billing: "Billable",
    }));

    onAddEntries(newEntries);

    // Reset form but keep name selected
    setDates([""]);
    setRangeStart("");
    setRangeEnd("");
    setJiraId("");
    setTask("");
    setEffort("8");
    setStatus("Done");
    setSprint("");
    setJobName("Development");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary"
      >
        <Plus className="w-4 h-4" />
        Add Record
      </button>
    );
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink flex items-center gap-2">
          <Plus className="w-5 h-5 text-accent" />
          Add New Record
        </h3>
        <button
          onClick={() => setOpen(false)}
          className="p-1 text-faint hover:text-muted rounded-lg hover:bg-surface-2"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Team Member */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Team Member
          </label>
          <select
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
          >
            {memberNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Job Name */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Job Name
          </label>
          <select
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
          >
            {JOB_NAMES.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>

        {/* Sprint */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Sprint
          </label>
          <input
            type="text"
            value={sprint}
            onChange={(e) => setSprint(e.target.value)}
            placeholder="e.g. 23"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
          />
        </div>
      </div>

      {/* Date selection mode toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <label className="block text-xs font-medium text-muted">
            Dates
          </label>
          <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg">
            <button
              onClick={() => setUseRange(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                !useRange
                  ? "bg-surface-2 text-accent shadow-sm"
                  : "text-muted hover:text-ink-soft"
              }`}
            >
              Pick Dates
            </button>
            <button
              onClick={() => setUseRange(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                useRange
                  ? "bg-surface-2 text-accent shadow-sm"
                  : "text-muted hover:text-ink-soft"
              }`}
            >
              <Copy className="w-3 h-3" />
              Date Range (Repeat)
            </button>
          </div>
        </div>

        {!useRange ? (
          <div className="flex flex-wrap gap-2 items-end">
            {dates.map((d, idx) => (
              <div key={idx} className="flex items-end gap-1">
                <input
                  type="date"
                  value={d}
                  onChange={(e) => updateDate(idx, e.target.value)}
                  className="rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
                />
                {dates.length > 1 && (
                  <button
                    onClick={() => removeDateSlot(idx)}
                    className="p-2 text-faint hover:text-red-500 rounded-lg hover:bg-danger-soft"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addDateSlot}
              className="px-3 py-2 text-sm text-accent hover:bg-accent-soft rounded-lg transition-colors font-medium"
            >
              + Add Date
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-muted mb-1">From</label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">To</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="rounded border-line-strong text-accent focus:ring-accent/40"
              />
              Skip weekends
            </label>
            {resolvedDates.length > 0 && (
              <span className="text-xs text-muted pb-2">
                {resolvedDates.length} day{resolvedDates.length !== 1 ? "s" : ""} selected
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Jira ID */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Jira ID
          </label>
          <input
            type="text"
            value={jiraId}
            onChange={(e) => setJiraId(e.target.value)}
            placeholder="e.g. CLS-7793"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
          />
        </div>

        {/* Task */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-muted mb-1">
            Task Description
          </label>
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Description of the work done"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
          />
        </div>

        {/* Effort */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Effort (hrs)
            </label>
            <input
              type="number"
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              min="0"
              max="24"
              step="0.5"
              className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
            >
              <option value="Done">Done</option>
              <option value="In Progress">In Progress</option>
              <option value="Stage">Stage</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-line">
        <p className="text-xs text-faint">
          {resolvedDates.length > 1
            ? `This record will be duplicated across ${resolvedDates.length} dates.`
            : resolvedDates.length === 1
              ? "1 date selected."
              : "Select at least one date."}
        </p>
        <button
          onClick={handleSubmit}
          disabled={resolvedDates.length === 0 || !task}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add {resolvedDates.length > 1 ? `${resolvedDates.length} Records` : "Record"}
        </button>
      </div>
    </div>
  );
}
