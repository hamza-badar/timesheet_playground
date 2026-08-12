import { useState, useMemo } from "react";
import { ClipboardCopy, FileText, Check } from "lucide-react";
import type { TimelogEntry } from "../lib/types";
import { generateSprintSummary, getSprintsInRange } from "../lib/summary";

interface SprintSummaryProps {
  entries: TimelogEntry[];
}

export default function SprintSummary({ entries }: SprintSummaryProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedSprint, setSelectedSprint] = useState("all");
  const [copied, setCopied] = useState(false);

  const uniqueNames = useMemo(
    () => [...new Set(entries.map((e) => e.name))].sort(),
    [entries]
  );

  const availableSprints = useMemo(() => {
    if (!startDate || !endDate) return [];
    return getSprintsInRange(
      entries,
      startDate,
      endDate,
      selectedUser === "all" ? undefined : selectedUser
    );
  }, [entries, startDate, endDate, selectedUser]);

  const summary = useMemo(() => {
    if (!startDate || !endDate) return null;
    return generateSprintSummary(
      entries,
      startDate,
      endDate,
      selectedUser === "all" ? undefined : selectedUser,
      selectedSprint === "all" ? undefined : selectedSprint
    );
  }, [entries, startDate, endDate, selectedUser, selectedSprint]);

  const handleCopy = async () => {
    if (summary?.clipboardFormatted) {
      await navigator.clipboard.writeText(summary.clipboardFormatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Sprint Deliverables Summary
        </h3>
        <p className="text-sm text-gray-500">
          Select a date range to generate a summary of completed deliverables.
          Tasks are included if they are marked as Done, or if they are not still
          In Progress after the end date.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedSprint("all");
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedSprint("all");
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Team Member
            </label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setSelectedSprint("all");
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">All Team Members</option>
              {uniqueNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Sprint
            </label>
            <select
              value={selectedSprint}
              onChange={(e) => setSelectedSprint(e.target.value)}
              disabled={availableSprints.length === 0}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">All Sprints</option>
              {availableSprints.map((s) => (
                <option key={s} value={s}>
                  Sprint {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Output */}
      {summary && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between bg-gray-50 px-5 py-3 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">
              {summary.items.length} deliverable{summary.items.length !== 1 ? "s" : ""} found
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-4 h-4" />
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>
          <pre className="p-5 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
            {summary.formatted}
          </pre>
        </div>
      )}

      {!summary && (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          Select a date range above to generate the sprint summary.
        </div>
      )}
    </div>
  );
}
