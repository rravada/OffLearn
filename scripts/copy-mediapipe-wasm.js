const fs = require("fs");
const path = require("path");

// --- onnxruntime-web WASM (for @xenova/transformers CPU inference) ---
// Only the non-threaded variants — we run with numThreads=1 to avoid the
// SharedArrayBuffer / cross-origin-isolation requirement.
const ortSrc = path.join(__dirname, "..", "node_modules", "@xenova", "transformers", "dist");
const ortDest = path.join(__dirname, "..", "public", "ort-wasm");

if (!fs.existsSync(ortSrc)) {
  console.warn("@xenova/transformers dist not found at", ortSrc);
} else {
  fs.mkdirSync(ortDest, { recursive: true });
  const ortFiles = ["ort-wasm.wasm", "ort-wasm-simd.wasm"];
  for (const file of ortFiles) {
    const src = path.join(ortSrc, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(ortDest, file));
    }
  }
  console.log(`Copied ort-wasm files to public/ort-wasm/`);
}

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
