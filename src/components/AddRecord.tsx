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
        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-sm font-medium text-sm"
      >
        <Plus className="w-4 h-4" />
        Add Record
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Plus className="w-5 h-5 text-green-600" />
          Add New Record
        </h3>
        <button
          onClick={() => setOpen(false)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Team Member */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Team Member
          </label>
          <select
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Job Name
          </label>
          <select
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Sprint
          </label>
          <input
            type="text"
            value={sprint}
            onChange={(e) => setSprint(e.target.value)}
            placeholder="e.g. 23"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Date selection mode toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <label className="block text-xs font-medium text-gray-600">
            Dates
          </label>
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
            <button
              onClick={() => setUseRange(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                !useRange
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Pick Dates
            </button>
            <button
              onClick={() => setUseRange(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                useRange
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
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
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {dates.length > 1 && (
                  <button
                    onClick={() => removeDateSlot(idx)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addDateSlot}
              className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
            >
              + Add Date
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Skip weekends
            </label>
            {resolvedDates.length > 0 && (
              <span className="text-xs text-gray-500 pb-2">
                {resolvedDates.length} day{resolvedDates.length !== 1 ? "s" : ""} selected
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Jira ID */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Jira ID
          </label>
          <input
            type="text"
            value={jiraId}
            onChange={(e) => setJiraId(e.target.value)}
            placeholder="e.g. CLS-7793"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Task */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Task Description
          </label>
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Description of the work done"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Effort */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Effort (hrs)
            </label>
            <input
              type="number"
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              min="0"
              max="24"
              step="0.5"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="Done">Done</option>
              <option value="In Progress">In Progress</option>
              <option value="Stage">Stage</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {resolvedDates.length > 1
            ? `This record will be duplicated across ${resolvedDates.length} dates.`
            : resolvedDates.length === 1
              ? "1 date selected."
              : "Select at least one date."}
        </p>
        <button
          onClick={handleSubmit}
          disabled={resolvedDates.length === 0 || !task}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add {resolvedDates.length > 1 ? `${resolvedDates.length} Records` : "Record"}
        </button>
      </div>
    </div>
  );
}
