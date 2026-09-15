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
    <div className="panel overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-accent" />
          <h3 className="display-title text-lg text-ink">
            Team Member Configuration
          </h3>
          <span className="text-xs text-faint ml-2">
            Configure fields for each team member used in the Timelogs export
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-faint" />
        ) : (
          <ChevronDown className="w-5 h-5 text-faint" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {memberNames.map((name) => {
            const config = configs.find((c) => c.name === name);
            return (
              <div
                key={name}
                className="border border-line rounded-xl p-4 space-y-3"
              >
                <h4 className="font-semibold text-ink">{name}</h4>
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
              className={`btn-primary ${saved ? "!bg-success-soft !text-success" : ""}`}
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
      <label className="field-label">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input"
      />
    </div>
  );
}
