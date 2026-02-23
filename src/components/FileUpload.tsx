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
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center
          transition-all duration-200 cursor-pointer
          ${
            dragOver
              ? "border-blue-500 bg-blue-50 scale-[1.02]"
              : fileName
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
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
              <FileSpreadsheet className="w-12 h-12 text-green-600" />
              <p className="text-lg font-semibold text-green-700">
                {fileName}
              </p>
              <p className="text-sm text-green-600">
                File loaded successfully. Drop another file to replace.
              </p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400" />
              <p className="text-lg font-semibold text-gray-600">
                Drop your Prosper Timesheet here
              </p>
              <p className="text-sm text-gray-500">
                or click to browse — accepts <code>.xlsx</code> files
              </p>
            </>
          )}
        </div>
      </div>

      {/* URL input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex-1 h-px bg-gray-200" />
          <span>or load from URL</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={urlLoading}
            />
          </div>
          <button
            onClick={handleUrlLoad}
            disabled={urlLoading || !url.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap transition-colors"
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
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {urlError}
          </p>
        )}
      </div>
    </div>
  );
}
