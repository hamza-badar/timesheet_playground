import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, Link, Loader2 } from "lucide-react";

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
}

function extractFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last.includes(".")) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return "Remote_Timesheet.xlsx";
}

export default function FileUpload({ onFileLoaded }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      setUrlError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        onFileLoaded(buffer, file.name);
      };
      reader.readAsArrayBuffer(file);
    },
    [onFileLoaded]
  );

  const handleUrlLoad = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setUrlLoading(true);
    setUrlError(null);

    try {
      const proxyUrl = `/api/fetch-xlsx?url=${encodeURIComponent(trimmed)}`;
      const res = await fetch(proxyUrl);

      if (!res.ok) {
        let msg = `Failed to fetch (${res.status})`;
        try {
          const body = await res.json();
          if (body.error) msg = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength < 100) {
        throw new Error(
          "Response too small — the URL may require authentication or is not a valid .xlsx file."
        );
      }

      const name = extractFileName(trimmed);
      setFileName(name);
      onFileLoaded(buffer, name);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch file from URL";
      setUrlError(message);
    } finally {
      setUrlLoading(false);
    }
  }, [url, onFileLoaded]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".xlsx")) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          relative border border-dashed rounded-2xl p-12 text-center
          transition-all duration-200 cursor-pointer panel
          ${
            dragOver
              ? "border-accent bg-accent-soft scale-[1.01]"
              : fileName
                ? "border-success/40 bg-success-soft"
                : "hover:border-line-strong"
          }
        `}
      >
        <input
          type="file"
          accept=".xlsx"
          onChange={onInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-3">
          {fileName ? (
            <>
              <FileSpreadsheet className="w-12 h-12 text-success" />
              <p className="display-title text-lg text-ink">{fileName}</p>
              <p className="text-sm text-muted">
                File loaded. Drop another file to replace.
              </p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-accent" />
              <p className="display-title text-lg text-ink">
                Drop your Prosper Timesheet here
              </p>
              <p className="text-sm text-muted">
                or click to browse — accepts <code className="text-accent">.xlsx</code> files
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="flex-1 h-px bg-line" />
          <span>or load from URL</span>
          <div className="flex-1 h-px bg-line" />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUrlLoad();
              }}
              placeholder="Paste a public .xlsx URL (SharePoint links must be shared with 'Anyone')"
              className="field-input pl-9"
              disabled={urlLoading}
            />
          </div>
          <button
            onClick={handleUrlLoad}
            disabled={urlLoading || !url.trim()}
            className="btn-primary whitespace-nowrap"
          >
            {urlLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load"
            )}
          </button>
        </div>
        {urlError && (
          <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-xl px-3 py-2">
            {urlError}
          </p>
        )}
      </div>
    </div>
  );
}
