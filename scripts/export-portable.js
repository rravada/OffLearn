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
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "out");
const MODEL_DIR = path.join(OUT, "model");
const MODEL_FILE = path.join(MODEL_DIR, "gemma-4-E2B-it-web.task");
const MODEL_LOCAL_PATH = "/model/gemma-4-E2B-it-web.task";
const ZIP_PATH = path.join(ROOT, "offlearn-portable.zip");

// ── Bundled static server ─────────────────────────────────────────────────────
// A tiny (~5 MB) static file server is bundled per-platform so the portable
// build needs nothing installed on the target machine except Chrome — no Python,
// no admin rights. Source: static-web-server (MIT), pinned + checksum-verified.
const SWS_VERSION = "v2.43.0";
const SWS_BASE =
  "https://github.com/static-web-server/static-web-server/releases/download/" +
  SWS_VERSION;
const SWS_SUMS_ASSET = "static-web-server-" + SWS_VERSION + "-SHA256SUM";
// Linux uses statically-linked musl builds so they run on old / varied distros
// without a matching glibc. Windows + macOS use the native targets.
const SERVERS = [
  { out: "sws-win-x64.exe", target: "x86_64-pc-windows-msvc", ext: ".zip", bin: "static-web-server.exe" },
  { out: "sws-win-x86.exe", target: "i686-pc-windows-msvc", ext: ".zip", bin: "static-web-server.exe" },
  { out: "sws-macos-arm64", target: "aarch64-apple-darwin", ext: ".tar.gz", bin: "static-web-server" },
  { out: "sws-macos-x64", target: "x86_64-apple-darwin", ext: ".tar.gz", bin: "static-web-server" },
  { out: "sws-linux-x64", target: "x86_64-unknown-linux-musl", ext: ".tar.gz", bin: "static-web-server" },
  { out: "sws-linux-arm64", target: "aarch64-unknown-linux-musl", ext: ".tar.gz", bin: "static-web-server" },
  { out: "sws-linux-armv7", target: "armv7-unknown-linux-musleabihf", ext: ".tar.gz", bin: "static-web-server" },
  { out: "sws-linux-x86", target: "i686-unknown-linux-musl", ext: ".tar.gz", bin: "static-web-server" },
];
function swsAssetName(s) {
  return "static-web-server-" + SWS_VERSION + "-" + s.target + s.ext;
}

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

// ── SHA-256 of a file ──────────────────────────────────────────────────────────
function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// ── Parse a "<hash>  <filename>" checksum manifest into { filename: hash } ──────
function parseChecksums(text) {
  var map = {};
  text.split(/\r?\n/).forEach(function (line) {
    var m = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (m) map[path.basename(m[2].trim())] = m[1].toLowerCase();
  });
  return map;
}

// ── Extract a .tar.gz or .zip archive (cross-platform, no npm deps) ─────────────
function extractArchive(archivePath, destDir) {
  function sh(cmd) { execSync(cmd, { stdio: "ignore" }); }
  if (archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tgz")) {
    sh('tar -xzf "' + archivePath + '" -C "' + destDir + '"');
  } else if (archivePath.endsWith(".zip")) {
    if (process.platform === "win32") {
      // PowerShell's Expand-Archive is always present and handles .zip natively,
      // unlike `tar` whose behaviour depends on which build is first on PATH
      // (GNU tar can't read zips; only the bundled bsdtar can).
      var ps =
        "Expand-Archive -Path '" + archivePath.replace(/'/g, "''") +
        "' -DestinationPath '" + destDir.replace(/'/g, "''") + "' -Force";
      sh('powershell -NoProfile -Command "' + ps + '"');
    } else {
      try { sh('unzip -o "' + archivePath + '" -d "' + destDir + '"'); }
      catch (_) { sh('tar -xf "' + archivePath + '" -C "' + destDir + '"'); }
    }
  } else {
    throw new Error("Unknown archive type: " + archivePath);
  }
}

// ── Download, verify, and unpack the per-platform static server binaries ────────
async function bundleServers() {
  var BIN_DIR = path.join(OUT, "bin");
  var DL_DIR = path.join(BIN_DIR, "_dl");
  fs.mkdirSync(DL_DIR, { recursive: true });

  console.log("Downloading server checksums (" + SWS_VERSION + ")…");
  var sumsFile = path.join(DL_DIR, "SHA256SUM");
  await downloadFile(SWS_BASE + "/" + SWS_SUMS_ASSET, sumsFile);
  var sums = parseChecksums(fs.readFileSync(sumsFile, "utf8"));

  for (var i = 0; i < SERVERS.length; i++) {
    var s = SERVERS[i];
    var outBin = path.join(BIN_DIR, s.out);
    if (fs.existsSync(outBin)) {
      console.log("  " + s.out + " already present, skipping.");
      continue;
    }

    var asset = swsAssetName(s);
    var archivePath = path.join(DL_DIR, asset);
    process.stdout.write("Downloading " + asset + " …\n");
    await downloadFile(SWS_BASE + "/" + asset, archivePath);

    var expected = sums[asset];
    if (!expected) throw new Error("No published checksum for " + asset);
    var actual = sha256File(archivePath);
    if (actual !== expected) {
      throw new Error(
        "Checksum mismatch for " + asset +
        "\n  expected " + expected + "\n  actual   " + actual
      );
    }

    var exDir = path.join(DL_DIR, s.out + "_x");
    fs.rmSync(exDir, { recursive: true, force: true });
    fs.mkdirSync(exDir, { recursive: true });
    extractArchive(archivePath, exDir);

    var found = walkFiles(exDir, function (binName) {
      return function (n) { return n === binName; };
    }(s.bin));
    if (!found.length) {
      throw new Error("Binary '" + s.bin + "' not found inside " + asset);
    }
    fs.copyFileSync(found[0], outBin);
    if (!s.out.endsWith(".exe")) {
      try { fs.chmodSync(outBin, 0o755); } catch (_) {}
    }
    console.log("  ✓ " + s.out + "  (sha256 verified)");
  }

  fs.rmSync(DL_DIR, { recursive: true, force: true });
  console.log(
    "Bundled " + SERVERS.length + " static-server binaries into out/bin/."
  );
}

// ── Launcher file content ──────────────────────────────────────────────────────
var RUN_SH = [
  "#!/usr/bin/env bash",
  "# OffLearn Portable Launcher — macOS / Linux",
  'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
  'cd "$SCRIPT_DIR" || exit 1',
  "PORT=3000",
  "",
  '# Pick the bundled static server for this OS / CPU architecture.',
  'OS="$(uname -s)"',
  'ARCH="$(uname -m)"',
  'SERVER=""',
  'case "$OS" in',
  "  Darwin)",
  '    case "$ARCH" in',
  '      arm64|aarch64) SERVER="bin/sws-macos-arm64" ;;',
  '      x86_64) SERVER="bin/sws-macos-x64" ;;',
  "    esac ;;",
  "  Linux)",
  '    case "$ARCH" in',
  '      x86_64|amd64) SERVER="bin/sws-linux-x64" ;;',
  '      aarch64|arm64) SERVER="bin/sws-linux-arm64" ;;',
  '      armv7l|armv6l|armhf) SERVER="bin/sws-linux-armv7" ;;',
  '      i686|i586|i386) SERVER="bin/sws-linux-x86" ;;',
  "    esac ;;",
  "esac",
  "",
  'SERVER_PID=""',
  'if [ -n "$SERVER" ] && [ -f "$SERVER" ]; then',
  '  chmod +x "$SERVER" 2>/dev/null',
  '  "$SERVER" --host 127.0.0.1 --port "$PORT" --root . >/dev/null 2>&1 &',
  "  SERVER_PID=$!",
  "elif command -v python3 >/dev/null 2>&1; then",
  '  python3 -m http.server "$PORT" >/dev/null 2>&1 &',
  "  SERVER_PID=$!",
  "elif command -v python >/dev/null 2>&1; then",
  '  python -m http.server "$PORT" >/dev/null 2>&1 &',
  "  SERVER_PID=$!",
  "else",
  '  echo "ERROR: no bundled server for $OS/$ARCH and Python was not found."',
  "  exit 1",
  "fi",
  "sleep 1",
  "",
  'URL="http://127.0.0.1:$PORT"',
  'echo "OffLearn running at $URL — press Ctrl+C to stop."',
  "",
  "if command -v google-chrome >/dev/null 2>&1; then",
  '  google-chrome "$URL" >/dev/null 2>&1 &',
  "elif command -v chromium-browser >/dev/null 2>&1; then",
  '  chromium-browser "$URL" >/dev/null 2>&1 &',
  "elif command -v chromium >/dev/null 2>&1; then",
  '  chromium "$URL" >/dev/null 2>&1 &',
  'elif [ "$OS" = "Darwin" ]; then',
  '  open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"',
  "else",
  '  echo "Open Chrome manually and navigate to $URL"',
  "fi",
  "",
  'wait "$SERVER_PID"',
  "",
].join("\n");

var RUN_BAT = [
  "@echo off",
  "setlocal",
  "set PORT=3000",
  'cd /d "%~dp0"',
  "",
  "rem Pick the bundled static server for this CPU architecture.",
  "set SERVER=bin\\sws-win-x64.exe",
  'if /I "%PROCESSOR_ARCHITECTURE%"=="x86" if not defined PROCESSOR_ARCHITEW6432 set SERVER=bin\\sws-win-x86.exe',
  "",
  'if exist "%SERVER%" goto haveserver',
  "where python >nul 2>&1 || goto noserver",
  "start /b python -m http.server %PORT%",
  "goto openbrowser",
  "",
  ":haveserver",
  'start "" /b "%SERVER%" --host 127.0.0.1 --port %PORT% --root .',
  "goto openbrowser",
  "",
  ":noserver",
  "echo ERROR: bundled server missing and Python was not found.",
  "pause",
  "exit /b 1",
  "",
  ":openbrowser",
  "timeout /t 2 /nobreak >nul",
  "set URL=http://127.0.0.1:%PORT%",
  "set CHROME1=%PROGRAMFILES%\\Google\\Chrome\\Application\\chrome.exe",
  "set CHROME2=%PROGRAMFILES(X86)%\\Google\\Chrome\\Application\\chrome.exe",
  "",
  'if exist "%CHROME1%" ( start "" "%CHROME1%" %URL% & goto done )',
  'if exist "%CHROME2%" ( start "" "%CHROME2%" %URL% & goto done )',
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
  "locally on your computer.",
  "",
  "REQUIREMENTS",
  "------------",
  "  • Google Chrome 113 or newer, on a desktop or laptop",
  "    (Chrome is required; the AI tutor uses WebGPU, which is desktop-only)",
  "",
  "  That's it. A small local web server is bundled for Windows, macOS, and",
  "  Linux, so you do NOT need Python or any other software installed.",
  "",
  "RUNNING THE APP",
  "---------------",
  "Windows:",
  "  1. Double-click run.bat",
  "  2. Chrome opens automatically at http://127.0.0.1:3000",
  "",
  "macOS / Linux:",
  "  1. Open a terminal in this folder",
  "  2. Run:  chmod +x run.sh && ./run.sh",
  "  3. Chrome opens automatically at http://127.0.0.1:3000",
  "",
  "FIRST LAUNCH",
  "------------",
  "A progress bar appears while the AI model initialises (~30–60 seconds",
  "on first run). After that it is cached and starts instantly.",
  "",
  "STOPPING THE SERVER",
  "-------------------",
  "Windows: close the terminal window that opened",
  "macOS / Linux: press Ctrl+C in the terminal",
  "",
  "TROUBLESHOOTING",
  "---------------",
  "Chrome does not open automatically:",
  "  Open Chrome manually and go to http://127.0.0.1:3000",
  "",
  "Port 3000 already in use:",
  "  Edit run.bat (or run.sh) and change PORT=3000 to any free port,",
  "  then open that port in Chrome (e.g. http://127.0.0.1:8080).",
  "",
  "The bundled server will not start (rare / unusual hardware):",
  "  Install Python 3 from https://python.org and re-run the launcher —",
  "  it automatically falls back to Python if the bundled server is missing.",
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

  // 5. Bundle the per-platform static server binaries
  await bundleServers();

  // 6. Write launcher files
  fs.writeFileSync(path.join(OUT, "run.sh"), RUN_SH);
  fs.writeFileSync(path.join(OUT, "run.bat"), RUN_BAT);
  fs.writeFileSync(path.join(OUT, "README.txt"), README_TXT);
  try { fs.chmodSync(path.join(OUT, "run.sh"), 0o755); } catch (_) {}
  console.log("Wrote run.sh, run.bat, README.txt.");

  // 7. Create zip
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
