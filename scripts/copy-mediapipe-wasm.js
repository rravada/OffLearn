const fs = require("fs");
const path = require("path");

// --- MediaPipe WASM ---
const mpSrc = path.join(__dirname, "..", "node_modules", "@mediapipe", "tasks-genai", "wasm");
const mpDest = path.join(__dirname, "..", "public", "mediapipe-wasm");

if (!fs.existsSync(mpSrc)) {
  console.warn("MediaPipe WASM source not found at", mpSrc);
} else {
  fs.mkdirSync(mpDest, { recursive: true });
  const files = fs.readdirSync(mpSrc);
  for (const file of files) {
    fs.copyFileSync(path.join(mpSrc, file), path.join(mpDest, file));
  }
  console.log(`Copied ${files.length} MediaPipe WASM files to public/mediapipe-wasm/`);
}

// --- PDF.js worker ---
const pdfSrc = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.js");
const pdfDest = path.join(__dirname, "..", "public", "pdf.worker.min.js");

if (!fs.existsSync(pdfSrc)) {
  console.warn("pdfjs-dist worker not found at", pdfSrc);
} else {
  fs.copyFileSync(pdfSrc, pdfDest);
  console.log("Copied PDF.js worker to public/pdf.worker.min.js");
}
