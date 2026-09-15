import { useState, useCallback, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { Download, Table2, FileText, LayoutDashboard, CalendarPlus } from "lucide-react";
import FileUpload from "./components/FileUpload";
import TimelogTable from "./components/TimelogTable";
import SprintSummary from "./components/SprintSummary";
import TeamConfig from "./components/TeamConfig";
import AddRecord from "./components/AddRecord";
import SheetBuilder from "./components/SheetBuilder";
import ThemeToggle from "./components/ThemeToggle";
import { parseTimesheetWorkbook } from "./lib/parser";
import { exportTimelogs } from "./lib/exporter";
import type { TimelogEntry, SheetMeta, MemberConfig } from "./lib/types";

const STORAGE_KEY = "timesheet-member-configs";

function loadSavedConfigs(): MemberConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MemberConfig[];
  } catch { /* ignore parse errors */ }
  return [];
}

function saveConfigs(configs: MemberConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch { /* ignore quota errors */ }
}

type Tab = "table" | "summary";
type AppMode = "converter" | "builder";

export default function App() {
  const [entries, setEntries] = useState<TimelogEntry[]>([]);
  const [sheetMetas, setSheetMetas] = useState<SheetMeta[]>([]);
  const [memberConfigs, setMemberConfigs] = useState<MemberConfig[]>(loadSavedConfigs);
  const [activeTab, setActiveTab] = useState<Tab>("table");
  const [appMode, setAppMode] = useState<AppMode>("builder");
  const [isLoaded, setIsLoaded] = useState(false);
  const filteredEntriesRef = useRef<TimelogEntry[]>([]);

  const uniqueUsers = useMemo(
    () => [...new Set(entries.map((e) => e.name))].sort(),
    [entries]
  );

  const handleConfigsChange = useCallback((configs: MemberConfig[]) => {
    setMemberConfigs(configs);
    saveConfigs(configs);
  }, []);

  const handleFileLoaded = useCallback((buffer: ArrayBuffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const result = parseTimesheetWorkbook(workbook);
    setEntries(result.entries);
    setSheetMetas(result.sheetMetas);
    filteredEntriesRef.current = result.entries;

    // Merge discovered names with any saved configs from localStorage
    const names = [...new Set(result.entries.map((e) => e.name))].sort();
    setMemberConfigs((prev) => {
      const existing = new Map(prev.map((c) => [c.name, c]));
      const merged = names.map((name) => {
        if (existing.has(name)) return existing.get(name)!;
        const parts = name.trim().split(/\s+/);
        return {
          name,
          firstName: parts[0] || "",
          lastName: parts.slice(1).join(" ") || "",
          employeeId: "",
          email: "",
          clientName: "",
          projectName: "Prosper",
        };
      });
      saveConfigs(merged);
      return merged;
    });
    setIsLoaded(true);
  }, []);

  const handleFilteredEntriesChange = useCallback((filtered: TimelogEntry[]) => {
    filteredEntriesRef.current = filtered;
  }, []);

  const handleExport = () => {
    const filtered = filteredEntriesRef.current;
    const uniqueNames = [...new Set(filtered.map((e) => e.name))];
    const memberPart = uniqueNames.length === 1
      ? uniqueNames[0].replace(/\s+/g, "_")
      : "All";
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `Timelogs_${memberPart}_${datePart}.xlsx`;
    exportTimelogs(filtered, memberConfigs, filename);
  };

  const handleAddEntries = useCallback((newEntries: TimelogEntry[]) => {
    setEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const handleUpdateEntry = useCallback((index: number, field: keyof TimelogEntry, value: string) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const totalHours = entries.reduce((sum, e) => sum + e.effort, 0);
  const uniqueJiraIds = [...new Set(entries.filter((e) => e.jiraId).map((e) => e.jiraId))];

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-50 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-accent shrink-0">
                <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="display-title text-lg sm:text-xl text-ink truncate">
                  Timesheet
                </h1>
                <p className="text-[11px] sm:text-xs text-muted hidden sm:block">
                  Prosper sheet builder &amp; timelog converter
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />
              <div className="segmented">
                <button
                  onClick={() => setAppMode("builder")}
                  className={`segmented-item ${appMode === "builder" ? "segmented-item-active" : ""}`}
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sheet builder</span>
                </button>
                <button
                  onClick={() => setAppMode("converter")}
                  className={`segmented-item ${appMode === "converter" ? "segmented-item-active" : ""}`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Converter</span>
                </button>
              </div>
              {isLoaded && appMode === "converter" && (
                <button onClick={handleExport} className="btn-primary text-xs sm:text-sm">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export Timelogs</span>
                  <span className="sm:hidden">Export</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {appMode === "builder" && (
          <SheetBuilder knownNames={uniqueUsers.length ? uniqueUsers : memberConfigs.map((c) => c.name)} />
        )}

        {appMode === "converter" && (
        <>
        {!isLoaded && (
          <div className="max-w-2xl mx-auto">
            <FileUpload onFileLoaded={handleFileLoaded} />
          </div>
        )}

        {isLoaded && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Team Members" value={uniqueUsers.length} />
              <StatCard label="Total Entries" value={entries.length} />
              <StatCard label="Total Hours" value={`${totalHours}h`} />
              <StatCard label="Jira Tickets" value={uniqueJiraIds.length} />
            </div>

            <TeamConfig
              memberNames={uniqueUsers}
              configs={memberConfigs}
              onConfigsChange={handleConfigsChange}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sheetMetas.map((meta) => (
                <div key={meta.month} className="panel p-5">
                  <h3 className="display-title text-lg text-ink mb-1">
                    {meta.month}
                  </h3>
                  <p className="text-xs text-muted mb-3">{meta.duration}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted">Working Days</span>
                    <span className="text-right font-medium text-ink-soft">
                      {meta.totalWorkingDays}
                    </span>
                    <span className="text-muted">Team Members</span>
                    <span className="text-right font-medium text-ink-soft">
                      {meta.users.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <AddRecord
              memberNames={uniqueUsers}
              onAddEntries={handleAddEntries}
            />

            <div className="segmented w-fit">
              <button
                onClick={() => setActiveTab("table")}
                className={`segmented-item ${activeTab === "table" ? "segmented-item-active" : ""}`}
              >
                <Table2 className="w-4 h-4" />
                Timelog Table
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`segmented-item ${activeTab === "summary" ? "segmented-item-active" : ""}`}
              >
                <FileText className="w-4 h-4" />
                Sprint Summary
              </button>
            </div>

            {activeTab === "table" && (
              <TimelogTable
                entries={entries}
                onFilteredEntriesChange={handleFilteredEntriesChange}
                onUpdateEntry={handleUpdateEntry}
              />
            )}
            {activeTab === "summary" && <SprintSummary entries={entries} />}

            <div className="pt-4 border-t border-line">
              <p className="text-sm text-muted mb-3">
                Upload a different timesheet:
              </p>
              <FileUpload onFileLoaded={handleFileLoaded} />
            </div>
          </>
        )}
        </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat-card">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">
        {label}
      </p>
      <p className="display-title text-2xl text-ink mt-1">{value}</p>
    </div>
  );
}
