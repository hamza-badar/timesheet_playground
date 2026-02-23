import type { VercelRequest, VercelResponse } from "@vercel/node";

const XLSX_SIGNATURES = [
  0x504b0304, // PK\x03\x04 (ZIP/XLSX magic bytes)
];

function isXlsxBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const sig = buf.readUInt32BE(0);
  return XLSX_SIGNATURES.includes(sig);
}

/**
 * Converts various SharePoint URL formats to direct download URLs.
 * SharePoint has multiple URL patterns:
 *   /:x:/r/personal/...  (browser view)
 *   /:x:/p/...           (sharing link)
 *   /personal/.../Documents/... (direct path)
 */
function toDownloadUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("sharepoint.com")) return url;

    // Extract the actual file path from SharePoint URLs
    // Pattern: /:x:/r/personal/user/Documents/path/file.xlsx
    const rMatch = u.pathname.match(/^\/:x:\/r(\/personal\/[^?]+\.xlsx)/i);
    if (rMatch) {
      const filePath = decodeURIComponent(rMatch[1]);
      return `${u.origin}${filePath}`;
    }

    // For sharing links (/:x:/p/...), append download=1
    u.searchParams.set("download", "1");
    return u.toString();
  } catch {
    return url;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  const downloadUrl = toDownloadUrl(url);

  try {
    const response = await fetch(downloadUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Remote server returned ${response.status}: ${response.statusText}`,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Detect if we got an HTML page (login/auth redirect) instead of an xlsx file
    const contentType = response.headers.get("content-type") || "";
    if (
      contentType.includes("text/html") ||
      (!isXlsxBuffer(buffer) && buffer.length > 0)
    ) {
      return res.status(403).json({
        error:
          "The URL returned an HTML page instead of an Excel file. " +
          "This usually means the file requires authentication. " +
          'Make sure the SharePoint link is shared with "Anyone with the link" access, ' +
          "or download the file manually and upload it.",
      });
    }

    if (buffer.length === 0) {
      return res.status(404).json({ error: "Empty response from remote URL" });
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Length", buffer.length);
    return res.status(200).send(buffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    return res.status(502).json({ error: message });
  }
}
