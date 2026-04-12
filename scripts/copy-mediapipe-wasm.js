const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "@mediapipe", "tasks-genai", "wasm");
const dest = path.join(__dirname, "..", "public", "mediapipe-wasm");

if (!fs.existsSync(src)) {
  console.warn("MediaPipe WASM source not found at", src);
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });

const files = fs.readdirSync(src);
for (const file of files) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

console.log(`Copied ${files.length} MediaPipe WASM files to public/mediapipe-wasm/`);
