#!/usr/bin/env node
/**
 * Creates a fully self-contained portable build of OffLearn.
 *
 * Downloads the Gemma model, patches compiled assets to use the local path,
 * writes launcher scripts, and zips everything into offlearn-portable.zip.
 *
 * Run after: npm run build
 * Usage:     node scripts/export-portable.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "out");
const MODEL_DIR = path.join(OUT, "model");
const MODEL_FILE = path.join(MODEL_DIR, "gemma-4-E2B-it-web.task");
const MODEL_LOCAL_PATH = "/model/gemma-4-E2B-it-web.task";
const ZIP_PATH = path.join(ROOT, "offlearn-portable.zip");

// ── Sanity check ──────────────────────────────────────────────────────────────
if (!fs.existsSync(OUT)) {
  console.error("\nERROR: out/ directory not found. Run `npm run build` first.\n");
  process.exit(1);
}

// ── Resolve model URL ─────────────────────────────────────────────────────────
function resolveModelUrl() {
  const fromEnv = (process.env.NEXT_PUBLIC_GEMMA_MODEL_URL || "").trim();
  if (fromEnv) return fromEnv;

  const swPath = path.join(OUT, "sw.js");
  if (fs.existsSync(swPath)) {
    const sw = fs.readFileSync(swPath, "utf8");
    const m = sw.match(/const BAKED_GEMMA_REMOTE_URL = "([^"]+)"/);
    if (m && m[1]) return m[1];
  }

  console.error(
    "\nERROR: Cannot determine Gemma model URL.\n\n" +
    "Fix one of:\n" +
    "  • Set NEXT_PUBLIC_GEMMA_MODEL_URL before running npm run build, OR\n" +
    "  • Place the model file manually at out/model/gemma-4-E2B-it-web.task\n" +
    "    then re-run this script (download will be skipped if sizes match).\n"
  );
  process.exit(1);
}

// ── HEAD request (returns Content-Length or null, follows redirects) ──────────
function headContentLength(url, redirects) {
  redirects = redirects || 0;
  return new Promise(function (resolve) {
    if (redirects > 10) return resolve(null);
    var proto = url.startsWith("https:") ? https : http;
    var req = proto.request(url, { method: "HEAD" }, function (res) {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve(headContentLength(res.headers.location, redirects + 1));
      } else {
        var len = parseInt(res.headers["content-length"] || "0", 10);
        resolve(len > 0 ? len : null);
      }
    });
    req.on("error", function () { resolve(null); });
    req.end();
  });
}

// ── Streaming download with redirect following and progress bar ───────────────
function downloadFile(url, dest, redirects) {
  redirects = redirects || 0;
  return new Promise(function (resolve, reject) {
    if (redirects > 10) return reject(new Error("Too many redirects"));
    var proto = url.startsWith("https:") ? https : http;
    proto.get(url, function (res) {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve(downloadFile(res.headers.location, dest, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        return reject(new Error("HTTP " + res.statusCode + " while downloading model"));
      }
      var total = parseInt(res.headers["content-length"] || "0", 10);
      var received = 0;
      var file = fs.createWriteStream(dest);
      res.on("data", function (chunk) {
        received += chunk.length;
        var recMB = (received / 1e6).toFixed(1);
        if (total > 0) {
          var totMB = (total / 1e6).toFixed(1);
          var pct = ((received / total) * 100).toFixed(1);
          process.stdout.write("\r  " + recMB + " MB / " + totMB + " MB (" + pct + "%)   ");
        } else {
          process.stdout.write("\r  " + recMB + " MB downloaded   ");
        }
      });
      res.pipe(file);
      file.on("finish", function () {
        file.close();
        process.stdout.write("\n");
        resolve();
      });
      file.on("error", function (err) {
        try { fs.unlinkSync(dest); } catch (_) {}
        reject(err);
      });
    }).on("error", reject);
  });
}

// ── Recursive file walker ──────────────────────────────────────────────────────
function walkFiles(dir, predicate, results) {
  results = results || [];
  if (!fs.existsSync(dir)) return results;
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, results);
    } else if (predicate(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// ── Launcher file content ──────────────────────────────────────────────────────
var RUN_SH = [
  "#!/usr/bin/env bash",
  "# OffLearn Portable Launcher — macOS / Linux",
  'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
  "PORT=3000",
  "",
  "if command -v python3 >/dev/null 2>&1; then",
  '  python3 -m http.server $PORT --directory "$SCRIPT_DIR" &',
  "elif command -v python >/dev/null 2>&1; then",
  '  python -m http.server $PORT --directory "$SCRIPT_DIR" &',
  "else",
  '  echo "ERROR: Python not found. Install Python 3 then re-run."',
  "  exit 1",
  "fi",
  "SERVER_PID=$!",
  "sleep 1",
  "",
  'URL="http://localhost:$PORT"',
  'echo "OffLearn running at $URL — press Ctrl+C to stop."',
  "",
  "if command -v google-chrome >/dev/null 2>&1; then",
  '  google-chrome "$URL" &',
  "elif command -v chromium-browser >/dev/null 2>&1; then",
  '  chromium-browser "$URL" &',
  "elif command -v chromium >/dev/null 2>&1; then",
  '  chromium "$URL" &',
  "elif [[ \"$OSTYPE\" == \"darwin\"* ]]; then",
  '  open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"',
  "else",
  '  echo "Open Chrome manually and navigate to $URL"',
  "fi",
  "",
  "wait $SERVER_PID",
  "",
].join("\n");

var RUN_BAT = [
  "@echo off",
  "setlocal",
  "set PORT=3000",
  'cd /d "%~dp0"',
  "",
  "start /b python -m http.server %PORT%",
  "timeout /t 2 /nobreak >nul",
  "",
  "set URL=http://localhost:%PORT%",
  "set CHROME1=%PROGRAMFILES%\\Google\\Chrome\\Application\\chrome.exe",
  "set CHROME2=%PROGRAMFILES(X86)%\\Google\\Chrome\\Application\\chrome.exe",
  "",
  'if exist "%CHROME1%" ( start "" "%CHROME1%" %URL% & goto :done )',
  'if exist "%CHROME2%" ( start "" "%CHROME2%" %URL% & goto :done )',
  "start chrome %URL% 2>nul || start \"\" %URL%",
  ":done",
  "endlocal",
  "",
].join("\n");

var README_TXT = [
  "OffLearn — Portable Offline Edition",
  "=====================================",
  "",
  "OffLearn is an offline school app with an AI tutor powered by the Gemma",
  "language model. No internet connection is required — everything runs",
  "locally on your machine.",
  "",
  "REQUIREMENTS",
  "------------",
  "  • Python 3  (to serve files locally — usually pre-installed on macOS/Linux)",
  "  • Google Chrome 113 or newer, on a desktop or laptop",
  "    (Chrome is required; the AI tutor uses WebGPU which is desktop-only)",
  "",
  "RUNNING THE APP",
  "---------------",
  "macOS / Linux:",
  "  1. Open a terminal in this folder",
  "  2. Run:  chmod +x run.sh && ./run.sh",
  "  3. Chrome opens automatically at http://localhost:3000",
  "",
  "Windows:",
  "  1. Double-click run.bat",
  "  2. Chrome opens automatically at http://localhost:3000",
  "",
  "FIRST LAUNCH",
  "------------",
  "A progress bar appears while the AI model initialises (~30–60 seconds",
  "on first run). After that it is cached and starts instantly.",
  "",
  "STOPPING THE SERVER",
  "-------------------",
  "macOS / Linux: press Ctrl+C in the terminal",
  "Windows: close the terminal window that opened",
  "",
  "TROUBLESHOOTING",
  "---------------",
  "Python not found:",
  "  Install Python 3 from https://python.org",
  "",
  "Chrome does not open automatically:",
  "  Open Chrome manually and go to http://localhost:3000",
  "",
  "Port 3000 already in use:",
  "  Edit run.sh (or run.bat) and change PORT=3000 to any free port,",
  "  then open that port in Chrome (e.g. http://localhost:8080).",
  "",
].join("\n");

// ── Main ──────────────────────────────────────────────────────────────────────
(async function main() {
  console.log("\n=== OffLearn Portable Export ===\n");

  // 1. Resolve model URL
  var modelUrl = resolveModelUrl();
  console.log("Model URL: " + modelUrl.slice(0, 72) + (modelUrl.length > 72 ? "…" : ""));

  // 2. Download model (skip if already present with matching size)
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  var skipDownload = false;
  if (fs.existsSync(MODEL_FILE)) {
    var localSize = fs.statSync(MODEL_FILE).size;
    process.stdout.write("Checking remote file size…");
    var remoteSize = await headContentLength(modelUrl);
    process.stdout.write("\r" + " ".repeat(40) + "\r");
    if (remoteSize && localSize === remoteSize) {
      console.log(
        "Model already present (" + (localSize / 1e6).toFixed(0) + " MB). Skipping download."
      );
      skipDownload = true;
    } else {
      console.log(
        "Size mismatch (local " +
          (localSize / 1e6).toFixed(0) +
          " MB, remote " +
          (remoteSize ? (remoteSize / 1e6).toFixed(0) : "unknown") +
          " MB). Re-downloading."
      );
    }
  }
  if (!skipDownload) {
    console.log("Downloading Gemma model — this file is large, please wait…");
    await downloadFile(modelUrl, MODEL_FILE);
    console.log(
      "  Saved to out/model/gemma-4-E2B-it-web.task (" +
        (fs.statSync(MODEL_FILE).size / 1e6).toFixed(0) +
        " MB)"
    );
  }

  // 3. Patch out/sw.js — clear baked remote URL
  var swPath = path.join(OUT, "sw.js");
  if (fs.existsSync(swPath)) {
    var swBody = fs.readFileSync(swPath, "utf8");
    var swPatched = swBody.replace(
      /^const BAKED_GEMMA_REMOTE_URL = .*?;/m,
      'const BAKED_GEMMA_REMOTE_URL = "";'
    );
    if (swPatched !== swBody) {
      fs.writeFileSync(swPath, swPatched);
      console.log("Patched out/sw.js  (BAKED_GEMMA_REMOTE_URL cleared).");
    }
  }

  // 4. Patch compiled JS + HTML — replace remote URL with local path
  if (modelUrl) {
    var jsFiles = walkFiles(path.join(OUT, "_next", "static"), function (n) {
      return n.endsWith(".js");
    });

    // Root-level .js files (e.g. sw.js already handled above, but scan anyway)
    fs.readdirSync(OUT).forEach(function (name) {
      if (name.endsWith(".js")) {
        var full = path.join(OUT, name);
        if (fs.statSync(full).isFile()) jsFiles.push(full);
      }
    });

    var htmlFiles = walkFiles(OUT, function (n) {
      return n.endsWith(".html");
    });

    var allFiles = jsFiles.concat(htmlFiles);
    var patchedCount = 0;

    allFiles.forEach(function (f) {
      var content = fs.readFileSync(f, "utf8");
      if (content.includes(modelUrl)) {
        fs.writeFileSync(f, content.split(modelUrl).join(MODEL_LOCAL_PATH));
        patchedCount++;
      }
    });

    console.log(
      "Patched " +
        patchedCount +
        " compiled file(s) — replaced remote URL → " +
        MODEL_LOCAL_PATH
    );
  }

  // 5. Write launcher files
  fs.writeFileSync(path.join(OUT, "run.sh"), RUN_SH);
  fs.writeFileSync(path.join(OUT, "run.bat"), RUN_BAT);
  fs.writeFileSync(path.join(OUT, "README.txt"), README_TXT);
  try { fs.chmodSync(path.join(OUT, "run.sh"), 0o755); } catch (_) {}
  console.log("Wrote run.sh, run.bat, README.txt.");

  // 6. Create zip
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  console.log("Creating offlearn-portable.zip…");

  try {
    execSync("zip -r ../offlearn-portable.zip .", { cwd: OUT, stdio: "inherit" });
  } catch (_) {
    // zip binary missing OR returned non-zero exit — fall back to PowerShell
    console.log("zip unavailable, using PowerShell Compress-Archive…");
    var psSource = OUT.replace(/'/g, "''");
    var psDest = ZIP_PATH.replace(/'/g, "''");
    execSync(
      "powershell -NoProfile -Command \"Compress-Archive -Path '" +
        psSource +
        "\\*' -DestinationPath '" +
        psDest +
        "' -Force\"",
      { stdio: "inherit" }
    );
  }

  console.log(
    "\n✓ Done!  offlearn-portable.zip → " + ZIP_PATH + "\n\n" +
    "Share this zip with students. They unzip it, run run.sh (Mac/Linux)\n" +
    "or run.bat (Windows), and the full app opens in Chrome — no internet needed.\n"
  );
})();
