// Tiny local dev server: serves static files + routes /api/* through Vercel-style handlers.
// Used for local preview only — Vercel serves the real thing in prod.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function mockRes(rawRes) {
  let statusCode = 200;
  const headers = {};
  return {
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    status(code) { statusCode = code; return this; },
    json(obj) {
      headers["content-type"] = headers["content-type"] || "application/json; charset=utf-8";
      rawRes.writeHead(statusCode, headers);
      rawRes.end(JSON.stringify(obj));
    },
    end(body) {
      rawRes.writeHead(statusCode, headers);
      rawRes.end(body);
    },
  };
}

async function callApi(filePath, req, rawRes) {
  try {
    const mod = await import(pathToFileURL(filePath).href + `?t=${Date.now()}`);
    const handler = mod.default;
    if (typeof handler !== "function") {
      rawRes.writeHead(500, { "content-type": "text/plain" });
      rawRes.end("api handler missing default export");
      return;
    }
    await handler(req, mockRes(rawRes));
  } catch (err) {
    console.error("[api error]", err);
    rawRes.writeHead(500, { "content-type": "application/json" });
    rawRes.end(JSON.stringify({ error: "handler_threw", detail: String(err && err.stack || err) }));
  }
}

function serveStatic(req, rawRes) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const resolved = path.normalize(path.join(ROOT, urlPath));
  if (!resolved.startsWith(ROOT)) {
    rawRes.writeHead(403); rawRes.end("forbidden"); return;
  }
  fs.stat(resolved, (err, stat) => {
    if (err || !stat.isFile()) {
      rawRes.writeHead(404, { "content-type": "text/plain" });
      rawRes.end("not found: " + urlPath);
      return;
    }
    const ct = MIME[path.extname(resolved).toLowerCase()] || "application/octet-stream";
    rawRes.writeHead(200, { "content-type": ct, "cache-control": "no-store" });
    fs.createReadStream(resolved).pipe(rawRes);
  });
}

const server = http.createServer(async (req, rawRes) => {
  const url = req.url || "/";
  if (url.startsWith("/api/")) {
    const apiPath = url.split("?")[0].replace(/^\//, "");
    const file = path.join(ROOT, apiPath + ".js");
    if (fs.existsSync(file)) {
      await callApi(file, req, rawRes);
      return;
    }
    rawRes.writeHead(404, { "content-type": "application/json" });
    rawRes.end(JSON.stringify({ error: "api_not_found", path: apiPath }));
    return;
  }
  serveStatic(req, rawRes);
});

server.listen(PORT, () => {
  console.log(`edge dev server: http://localhost:${PORT}`);
});
