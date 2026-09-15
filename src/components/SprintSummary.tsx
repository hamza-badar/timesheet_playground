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
      <div className="panel-muted p-5 space-y-4">
        <h3 className="display-title text-xl text-ink flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          Sprint Deliverables Summary
        </h3>
        <p className="text-sm text-muted">
          Select a date range to generate a summary of completed deliverables.
          Tasks are included if they are marked as Done, or if they are not still
          In Progress after the end date.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedSprint("all");
              }}
              className="rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedSprint("all");
              }}
              className="rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Team Member
            </label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setSelectedSprint("all");
              }}
              className="rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none"
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
            <label className="block text-xs font-medium text-muted mb-1">
              Sprint
            </label>
            <select
              value={selectedSprint}
              onChange={(e) => setSelectedSprint(e.target.value)}
              disabled={availableSprints.length === 0}
              className="rounded-lg border border-line-strong px-3 py-2 text-sm bg-surface-2 focus:ring-2 focus:ring-accent/40 focus:border-accent/60 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between bg-surface-2 px-5 py-3 border-b border-line">
            <span className="text-sm font-medium text-ink-soft">
              {summary.items.length} deliverable{summary.items.length !== 1 ? "s" : ""} found
            </span>
            <button
              onClick={handleCopy}
              className="btn-primary !py-1.5 !px-3 text-sm"
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
          <pre className="p-5 text-sm text-ink whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
            {summary.formatted}
          </pre>
        </div>
      )}

      {!summary && (
        <div className="text-center py-12 text-faint panel-muted border-2 border-dashed border-line">
          Select a date range above to generate the sprint summary.
        </div>
      )}
    </div>
  );
}
