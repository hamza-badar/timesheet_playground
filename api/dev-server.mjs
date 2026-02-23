import http from "node:http";

function isXlsxBuffer(buf) {
  if (buf.length < 4) return false;
  return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

function toDownloadUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("sharepoint.com")) return url;

    const rMatch = u.pathname.match(/^\/:x:\/r(\/personal\/[^?]+\.xlsx)/i);
    if (rMatch) {
      const filePath = decodeURIComponent(rMatch[1]);
      return `${u.origin}${filePath}`;
    }

    u.searchParams.set("download", "1");
    return u.toString();
  } catch {
    return url;
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, "http://localhost:3001");

  if (parsed.pathname !== "/api/fetch-xlsx") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const targetUrl = parsed.searchParams.get("url");
  if (!targetUrl) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing 'url' query parameter" }));
    return;
  }

  const downloadUrl = toDownloadUrl(targetUrl);

  try {
    const response = await fetch(downloadUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: `Remote server returned ${response.status}: ${response.statusText}`,
        })
      );
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const contentType = response.headers.get("content-type") || "";
    if (
      contentType.includes("text/html") ||
      (!isXlsxBuffer(buffer) && buffer.length > 0)
    ) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            "The URL returned an HTML page instead of an Excel file. " +
            "This usually means the file requires authentication. " +
            'Make sure the SharePoint link is shared with "Anyone with the link" access, ' +
            "or download the file manually and upload it.",
        })
      );
      return;
    }

    if (buffer.length === 0) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Empty response from remote URL" }));
      return;
    }

    res.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message || "Unknown fetch error" }));
  }
});

server.listen(3001, () => {
  console.log("API dev server running on http://localhost:3001");
});
