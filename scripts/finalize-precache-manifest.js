/**
 * After `next build` (static export to `out/`), merge all `out/_next/static/**`
 * assets into precache-manifest.json so the service worker can cache JS/CSS/fonts
 * before the user visits every route — required for offline without prior clicks.
 */
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "out");
const manifestPath = path.join(outDir, "precache-manifest.json");

const ASSET_EXT = /\.(js|mjs|css|woff2|woff|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)$/i;

function walkAssetFiles(dir) {
  const acc = [];
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) acc.push(...walkAssetFiles(full));
    else if (ASSET_EXT.test(name)) acc.push(full);
  }
  return acc;
}

function main() {
  if (!fs.existsSync(outDir)) {
    console.warn("finalize-precache-manifest: out/ missing (run next build first), skip.");
    process.exit(0);
  }
  if (!fs.existsSync(manifestPath)) {
    console.warn("finalize-precache-manifest: precache-manifest.json missing in out/, skip.");
    process.exit(0);
  }

  const existing = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const urls = new Set(Array.isArray(existing.urls) ? existing.urls : []);

  const nextStaticRoot = path.join(outDir, "_next", "static");
  for (const abs of walkAssetFiles(nextStaticRoot)) {
    urls.add("/" + path.relative(outDir, abs).split(path.sep).join("/"));
  }

  for (const extra of ["index.html", "404.html"]) {
    const p = path.join(outDir, extra);
    if (fs.existsSync(p)) urls.add("/" + extra);
  }

  const sorted = [...urls].sort();
  const payload = {
    version: existing.version ?? 1,
    generatedAt: new Date().toISOString(),
    urls: sorted,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(payload));
  console.log(`finalize-precache-manifest: ${sorted.length} URLs (includes Next static assets)`);
}

main();
