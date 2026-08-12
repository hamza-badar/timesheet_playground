import { Fragment, useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import type { TimelogEntry } from "../lib/types";
import { isLeaveOrHoliday } from "../lib/filters";

interface TimelogTableProps {
  entries: TimelogEntry[];
  onFilteredEntriesChange?: (filtered: TimelogEntry[]) => void;
  onUpdateEntry?: (index: number, field: keyof TimelogEntry, value: string) => void;
}

const JOB_NAME_OPTIONS = [
  "Client Calls",
  "Development",
  "Internal Calls",
  "Training",
];

const BILLING_OPTIONS = ["Billable", "Non-Billable"];

type SortField = "name" | "date" | "jobName" | "jiraId" | "effort" | "status" | "sprint" | "billing";
type SortDir = "asc" | "desc";

export default function TimelogTable({ entries, onFilteredEntriesChange, onUpdateEntry }: TimelogTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterName, setFilterName] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);

  const uniqueNames = useMemo(
    () => [...new Set(entries.map((e) => e.name))].sort(),
    [entries]
  );
  const uniqueStatuses = useMemo(
    () => [...new Set(entries.map((e) => e.status).filter(Boolean))].sort(),
    [entries]
  );

  const indexedEntries = useMemo(
    () => entries.map((e, i) => ({ ...e, _idx: i })),
    [entries]
  );

  const filtered = useMemo(() => {
    return indexedEntries.filter((e) => {
      if (isLeaveOrHoliday(e)) return false;
      if (filterName !== "all" && e.name !== filterName) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      return true;
    });
  }, [indexedEntries, filterName, startDate, endDate, filterStatus]);

  useEffect(() => {
    onFilteredEntriesChange?.(filtered);
  }, [filtered, onFilteredEntriesChange]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "date":
          cmp = a.date.localeCompare(b.date);
          break;
        case "jiraId":
          cmp = a.jiraId.localeCompare(b.jiraId);
          break;
        case "jobName":
          cmp = a.jobName.localeCompare(b.jobName);
          break;
        case "effort":
          cmp = a.effort - b.effort;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "sprint":
          cmp = a.sprint.localeCompare(b.sprint);
          break;
        case "billing":
          cmp = a.billing.localeCompare(b.billing);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const totalEffort = sorted.reduce((sum, e) => sum + e.effort, 0);

  type IndexedEntry = TimelogEntry & { _idx: number };

  const dateGroups = useMemo(() => {
    const groups: {
      date: string;
      day: string;
      entries: IndexedEntry[];
      totalEffort: number;
    }[] = [];

    for (const entry of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.date === entry.date) {
        last.entries.push(entry);
        last.totalEffort += entry.effort;
      } else {
        groups.push({
          date: entry.date,
          day: entry.day,
          entries: [entry],
          totalEffort: entry.effort,
        });
      }
    }

    return groups;
  }, [sorted]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-3 items-end bg-gray-50 rounded-xl p-4">
        <Filter className="w-5 h-5 text-gray-500 hidden md:block mb-2" />
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Team Member</label>
          <select
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">All Team Members</option>
            {uniqueNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {(startDate || endDate || filterName !== "all" || filterStatus !== "all") && (
          <button
            onClick={() => { setStartDate(""); setEndDate(""); setFilterName("all"); setFilterStatus("all"); }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Clear all filters"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
        <div className="col-span-2 sm:col-span-3 md:ml-auto text-sm text-gray-500">
          {sorted.length} entries | {totalEffort}h total effort
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700 font-semibold">
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort("name")}>
                Name <SortIcon field="name" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort("date")}>
                Date <SortIcon field="date" />
              </th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort("jobName")}>
                Job Name <SortIcon field="jobName" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort("jiraId")}>
                Jira ID <SortIcon field="jiraId" />
              </th>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors text-right" onClick={() => toggleSort("effort")}>
                Effort <SortIcon field="effort" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort("status")}>
                Status <SortIcon field="status" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort("billing")}>
                Billing <SortIcon field="billing" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort("sprint")}>
                Sprint <SortIcon field="sprint" />
              </th>
            </tr>
          </thead>
          <tbody>
            {dateGroups.map((group) => (
              <Fragment key={`${group.date}-${group.entries[0]._idx}`}>
                {group.entries.map((entry) => (
              <tr
                key={entry._idx}
                className="border-t border-gray-100 hover:bg-blue-50/50 transition-colors"
              >
                <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                  {entry.name}
                </td>
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                  {entry.date}
                </td>
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                  {entry.day}
                </td>
                <td className="px-3 py-1.5 min-w-[160px]">
                  <select
                    value={entry.jobName}
                    onChange={(e) => onUpdateEntry?.(entry._idx, "jobName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-800 bg-white hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {JOB_NAME_OPTIONS.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  {entry.jiraId && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs font-mono px-2 py-0.5 rounded-md">
                      {entry.jiraId}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 relative max-w-[200px]">
                  <div
                    className="text-gray-700 truncate cursor-default"
                    onMouseEnter={() => setHoveredTask(entry._idx)}
                    onMouseLeave={() => setHoveredTask(null)}
                  >
                    {entry.task}
                  </div>
                  {hoveredTask === entry._idx && entry.task && (
                    <div className="absolute left-0 bottom-full mb-2 z-50 max-w-sm w-max bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-normal break-words">
                      {entry.task}
                      <div className="absolute left-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-700 whitespace-nowrap">
                  {entry.effort > 0 ? `${entry.effort}h` : ""}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={entry.status} />
                </td>
                <td className="px-3 py-1.5 min-w-[140px]">
                  <select
                    value={entry.billing || "Billable"}
                    onChange={(e) => onUpdateEntry?.(entry._idx, "billing", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-800 bg-white hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {BILLING_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-gray-600 text-center">
                  {entry.sprint}
                </td>
              </tr>
                ))}
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={6} className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                    Daily total — {group.date} ({group.day})
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                    {group.totalEffort}h
                  </td>
                  <td colSpan={3} />
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No entries match the current filters.
          </div>
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {sorted.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            No entries match the current filters.
          </div>
        )}
        {dateGroups.map((group) => (
          <div key={`${group.date}-${group.entries[0]._idx}`} className="space-y-3">
            {group.entries.map((entry) => (
          <div
            key={entry._idx}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
          >
            {/* Header row */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">{entry.name}</span>
              <span className="text-xs text-gray-500">
                {entry.date} &middot; {entry.day}
              </span>
            </div>

            {/* Task - full text visible */}
            <p className="text-sm text-gray-700 leading-relaxed">{entry.task}</p>

            {/* Jira + Effort + Status row */}
            <div className="flex flex-wrap items-center gap-2">
              {entry.jiraId && (
                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-mono px-2 py-0.5 rounded-md">
                  {entry.jiraId}
                </span>
              )}
              {entry.effort > 0 && (
                <span className="inline-block bg-gray-100 text-gray-700 text-xs font-mono px-2 py-0.5 rounded-md">
                  {entry.effort}h
                </span>
              )}
              <StatusBadge status={entry.status} />
              {entry.sprint && (
                <span className="text-xs text-gray-500">Sprint {entry.sprint}</span>
              )}
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Job Name</label>
                <select
                  value={entry.jobName}
                  onChange={(e) => onUpdateEntry?.(entry._idx, "jobName", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm font-medium text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {JOB_NAME_OPTIONS.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Billing</label>
                <select
                  value={entry.billing || "Billable"}
                  onChange={(e) => onUpdateEntry?.(entry._idx, "billing", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm font-medium text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {BILLING_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
            ))}
            <div className="flex justify-end px-1">
              <span className="text-sm font-semibold text-gray-700">
                Daily total — {group.date}: {group.totalEffort}h
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;

  const styles: Record<string, string> = {
    Done: "bg-green-100 text-green-800",
    "In Progress": "bg-amber-100 text-amber-800",
    Stage: "bg-purple-100 text-purple-800",
  };

  const cls = styles[status] || "bg-gray-100 text-gray-700";

  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  );
}
