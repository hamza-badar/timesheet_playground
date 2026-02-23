import { useState } from "react";
import { Users, ChevronDown, ChevronUp, Save } from "lucide-react";
import type { MemberConfig } from "../lib/types";

interface TeamConfigProps {
  memberNames: string[];
  configs: MemberConfig[];
  onConfigsChange: (configs: MemberConfig[]) => void;
}

export default function TeamConfig({
  memberNames,
  configs,
  onConfigsChange,
}: TeamConfigProps) {
  const [expanded, setExpanded] = useState(true);
  const [saved, setSaved] = useState(false);

  const updateConfig = (
    name: string,
    field: keyof MemberConfig,
    value: string
  ) => {
    const updated = configs.map((c) =>
      c.name === name ? { ...c, [field]: value } : c
    );
    onConfigsChange(updated);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">
            Team Member Configuration
          </h3>
          <span className="text-xs text-gray-400 ml-2">
            Configure fields for each team member used in the Timelogs export
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {memberNames.map((name) => {
            const config = configs.find((c) => c.name === name);
            return (
              <div
                key={name}
                className="border border-gray-200 rounded-xl p-4 space-y-3"
              >
                <h4 className="font-semibold text-gray-800">{name}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field
                    label="First Name"
                    value={config?.firstName || ""}
                    placeholder="e.g. Hamza"
                    onChange={(v) => updateConfig(name, "firstName", v)}
                  />
                  <Field
                    label="Last Name"
                    value={config?.lastName || ""}
                    placeholder="e.g. Badar"
                    onChange={(v) => updateConfig(name, "lastName", v)}
                  />
                  <Field
                    label="Employee ID"
                    value={config?.employeeId || ""}
                    placeholder="e.g. EMP-001"
                    onChange={(v) => updateConfig(name, "employeeId", v)}
                  />
                  <Field
                    label="Email ID"
                    value={config?.email || ""}
                    placeholder="name@company.com"
                    type="email"
                    onChange={(v) => updateConfig(name, "email", v)}
                  />
                  <Field
                    label="Client Name"
                    value={config?.clientName || ""}
                    placeholder="e.g. Prosper Marketplace"
                    onChange={(v) => updateConfig(name, "clientName", v)}
                  />
                  <Field
                    label="Project Name"
                    value={config?.projectName || ""}
                    placeholder="e.g. Prosper"
                    onChange={(v) => updateConfig(name, "projectName", v)}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
                saved
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              <Save className="w-4 h-4" />
              {saved ? "Saved" : "Save Configuration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />
    </div>
  );
}
