/**
 * After static export, inject NEXT_PUBLIC_GEMMA_MODEL_URL into out/sw.js so the
 * service worker can intercept and cache the cross-origin Gemma .task (offline).
 */
const fs = require("fs");
const path = require("path");

const outSw = path.join(__dirname, "..", "out", "sw.js");
const modelUrl = (process.env.NEXT_PUBLIC_GEMMA_MODEL_URL || "").trim();

if (!fs.existsSync(outSw)) {
  console.warn("bake-sw-remote-model: out/sw.js missing, skip.");
  process.exit(0);
}

let body = fs.readFileSync(outSw, "utf8");
const replacement = `const BAKED_GEMMA_REMOTE_URL = ${JSON.stringify(modelUrl)};`;
const marker = /^const BAKED_GEMMA_REMOTE_URL = .*?;/m;
if (!marker.test(body)) {
  console.warn("bake-sw-remote-model: BAKED_GEMMA_REMOTE_URL line not found, skip.");
  process.exit(0);
}

body = body.replace(marker, replacement);
fs.writeFileSync(outSw, body);

if (modelUrl) {
  console.log(
    `bake-sw-remote-model: SW will cache remote model (${modelUrl.slice(0, 56)}…)`
  );
} else {
  console.log(
    "bake-sw-remote-model: no NEXT_PUBLIC_GEMMA_MODEL_URL — use /public/models/*.task locally"
  );
}
