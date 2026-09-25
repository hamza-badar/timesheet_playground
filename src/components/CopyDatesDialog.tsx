import { useMemo, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import dayjs from "dayjs";

/** Parse "1,2,3-10" into unique day numbers. Throws on invalid tokens. */
export function parseDaySpec(spec: string): number[] {
  const tokens = spec
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    throw new Error("Enter days like 1,2,3-10");
  }

  const days = new Set<number>();
  for (const token of tokens) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let start = Number(range[1]);
      let end = Number(range[2]);
      if (start > end) [start, end] = [end, start];
      if (start < 1 || end > 31) {
        throw new Error(`Day range ${token} is out of range`);
      }
      for (let d = start; d <= end; d++) days.add(d);
      continue;
    }
    if (/^\d+$/.test(token)) {
      const day = Number(token);
      if (day < 1 || day > 31) {
        throw new Error(`Day ${token} is out of range`);
      }
      days.add(day);
      continue;
    }
    throw new Error(`Could not parse “${token}”`);
  }
  return [...days].sort((a, b) => a - b);
}

export interface CopyDateOption {
  date: string;
  count: number;
}

interface CopyDatesDialogProps {
  title?: string;
  dates: CopyDateOption[];
  initialSelected?: string[];
  copying?: boolean;
  onCancel: () => void;
  onCopy: (dates: string[]) => void;
  countLabel?: string;
}

export default function CopyDatesDialog({
  title = "Copy selected dates",
  dates,
  initialSelected,
  copying = false,
  onCancel,
  onCopy,
  countLabel = "line",
}: CopyDatesDialogProps) {
  const defaultSelected = useMemo(() => {
    const allowed = new Set(dates.map((d) => d.date));
    const fromInitial = (initialSelected || []).filter((d) => allowed.has(d));
    if (fromInitial.length) return fromInitial;
    return dates.map((d) => d.date);
  }, [dates, initialSelected]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));
  const [daySpec, setDaySpec] = useState("");
  const [specHint, setSpecHint] = useState<string | null>(null);

  const allSelected = dates.length > 0 && dates.every((d) => selected.has(d.date));

  const applyDaySpec = () => {
    try {
      const wanted = new Set(parseDaySpec(daySpec));
      const matched = dates.filter((item) => wanted.has(dayjs(item.date).date()));
      if (matched.length === 0) {
        setSpecHint("No listed dates match that pattern.");
        return;
      }
      setSelected(new Set(matched.map((item) => item.date)));
      const missing = [...wanted].filter(
        (day) => !dates.some((item) => dayjs(item.date).date() === day)
      );
      setSpecHint(
        missing.length
          ? `Selected ${matched.length}. Not in list: ${missing.join(", ")}`
          : `Selected ${matched.length} ${matched.length === 1 ? "date" : "dates"}.`
      );
    } catch (err) {
      setSpecHint(err instanceof Error ? err.message : "Could not parse days.");
    }
  };

  const toggle = (iso: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(dates.map((d) => d.date)));
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="panel w-full max-w-md p-5 sm:p-6 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-dates-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-1">
              Copy for Excel
            </p>
            <h3 id="copy-dates-title" className="display-title text-xl text-ink">
              {title}
            </h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Tick dates, or type days like 1,2,3-10. A normal click on Copy for Excel
              still copies everything.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {dates.length === 0 ? (
          <p className="text-sm text-muted rounded-xl border border-dashed border-line px-4 py-6 text-center">
            No dates to copy yet.
          </p>
        ) : (
          <>
            <div>
              <label className="field-label">Days</label>
              <div className="flex gap-2">
                <input
                  value={daySpec}
                  onChange={(e) => {
                    setDaySpec(e.target.value);
                    if (specHint) setSpecHint(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyDaySpec();
                    }
                  }}
                  placeholder="1,2,3-10"
                  aria-label="Days like 1,2,3-10"
                  className="field-input"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={applyDaySpec}
                  disabled={!daySpec.trim()}
                  className="btn-secondary shrink-0"
                >
                  Apply
                </button>
              </div>
              {specHint ? (
                <p className="text-xs text-muted mt-1.5">{specHint}</p>
              ) : (
                <p className="text-xs text-faint mt-1.5">
                  Commas for individual days, a hyphen for a range.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-accent hover:text-ink"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
            <ul className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {dates.map((item) => {
                const checked = selected.has(item.date);
                return (
                  <li key={item.date}>
                    <label className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 hover:border-accent hover:bg-accent-soft/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.date)}
                        className="accent-[var(--accent)]"
                      />
                      <span className="flex-1 text-sm text-ink">
                        {dayjs(item.date).format("ddd D-MMM-YY")}
                      </span>
                      <span className="text-xs text-muted">
                        {item.count} {item.count === 1 ? countLabel : `${countLabel}s`}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCopy([...selected].sort())}
            disabled={copying || selected.size === 0}
            className="btn-primary"
          >
            {copying ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copying ? "Copied" : `Copy ${selected.size} ${selected.size === 1 ? "date" : "dates"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
