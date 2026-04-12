/**
 * Writes public/precache-manifest.json — all curriculum, test prep, WASM, etc.
 * Run automatically before `next build` (see package.json).
 */
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "..", "public");
const outFile = path.join(publicDir, "precache-manifest.json");

function walkFiles(dir, predicate) {
  const acc = [];
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) acc.push(...walkFiles(full, predicate));
    else if (predicate(e.name, full)) acc.push(full);
  }
  return acc;
}

function toUrl(publicRoot, absolutePath) {
  const rel = path.relative(publicRoot, absolutePath).split(path.sep).join("/");
  return "/" + rel;
}

const urls = new Set();

for (const f of walkFiles(
  path.join(publicDir, "curriculum"),
  (name) => name.endsWith(".json")
)) {
  urls.add(toUrl(publicDir, f));
}

for (const f of walkFiles(
  path.join(publicDir, "testprep"),
  (name) => name.endsWith(".json")
)) {
  urls.add(toUrl(publicDir, f));
}

for (const f of walkFiles(path.join(publicDir, "mediapipe-wasm"), (name) => {
  const l = name.toLowerCase();
  return l.endsWith(".js") || l.endsWith(".wasm") || l.endsWith(".data");
})) {
  urls.add(toUrl(publicDir, f));
}

const pdfWorker = path.join(publicDir, "pdf.worker.min.js");
if (fs.existsSync(pdfWorker)) urls.add("/pdf.worker.min.js");

for (const f of walkFiles(path.join(publicDir, "models"), (name) => {
  const l = name.toLowerCase();
  return l.endsWith(".task") || l.endsWith(".bin") || l.endsWith(".onnx");
})) {
  urls.add(toUrl(publicDir, f));
}

for (const f of walkFiles(
  path.join(publicDir, "knowledge-packs"),
  (name) => name.endsWith(".json")
)) {
  urls.add(toUrl(publicDir, f));
}

const sorted = [...urls].sort();

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      urls: sorted,
    },
    null,
    0
  )
);
console.log(`precache-manifest.json: ${sorted.length} URLs`);
