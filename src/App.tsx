import { useState, useCallback, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { Download, Table2, FileText, LayoutDashboard } from "lucide-react";
import FileUpload from "./components/FileUpload";
import TimelogTable from "./components/TimelogTable";
import SprintSummary from "./components/SprintSummary";
import TeamConfig from "./components/TeamConfig";
import AddRecord from "./components/AddRecord";
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

export default function App() {
  const [entries, setEntries] = useState<TimelogEntry[]>([]);
  const [sheetMetas, setSheetMetas] = useState<SheetMeta[]>([]);
  const [memberConfigs, setMemberConfigs] = useState<MemberConfig[]>(loadSavedConfigs);
  const [activeTab, setActiveTab] = useState<Tab>("table");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <LayoutDashboard className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">
                  Timesheet Converter
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  Prosper Timesheet to Timelogs converter & Sprint Summary generator
                </p>
              </div>
            </div>
            {isLoaded && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium text-xs sm:text-sm shrink-0"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export Timelogs.xlsx</span>
                <span className="sm:hidden">Export</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Upload Section */}
        {!isLoaded && (
          <div className="max-w-2xl mx-auto">
            <FileUpload onFileLoaded={handleFileLoaded} />
          </div>
        )}

        {/* Dashboard */}
        {isLoaded && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Team Members" value={uniqueUsers.length} />
              <StatCard label="Total Entries" value={entries.length} />
              <StatCard label="Total Hours" value={`${totalHours}h`} />
              <StatCard label="Jira Tickets" value={uniqueJiraIds.length} />
            </div>

            {/* Team Configuration */}
            <TeamConfig
              memberNames={uniqueUsers}
              configs={memberConfigs}
              onConfigsChange={handleConfigsChange}
            />

            {/* Months Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sheetMetas.map((meta) => (
                <div
                  key={meta.month}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {meta.month}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">{meta.duration}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">Working Days</span>
                    <span className="text-right font-medium">
                      {meta.totalWorkingDays}
                    </span>
                    <span className="text-gray-500">Team Members</span>
                    <span className="text-right font-medium">
                      {meta.users.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Record */}
            <AddRecord
              memberNames={uniqueUsers}
              onAddEntries={handleAddEntries}
            />

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab("table")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "table"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <Table2 className="w-4 h-4" />
                Timelog Table
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "summary"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <FileText className="w-4 h-4" />
                Sprint Summary
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === "table" && (
              <TimelogTable
                entries={entries}
                onFilteredEntriesChange={handleFilteredEntriesChange}
                onUpdateEntry={handleUpdateEntry}
              />
            )}
            {activeTab === "summary" && <SprintSummary entries={entries} />}

            {/* Re-upload */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-3">
                Upload a different timesheet:
              </p>
              <FileUpload onFileLoaded={handleFileLoaded} />
            </div>
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
