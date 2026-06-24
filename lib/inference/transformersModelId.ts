/**
 * ONNX model ID used for the CPU (Transformers.js / WASM) inference path.
 *
 * - **Default:** `Xenova/Qwen1.5-0.5B-Chat` — ~0.5 B params, instruct-tuned,
 *   ships a quantized ONNX variant compatible with Transformers.js v2.
 * - **Override:** set `NEXT_PUBLIC_CPU_MODEL_ID` to any HuggingFace model ID
 *   that is compatible with the `text-generation` pipeline and has a chat
 *   template (e.g. `Xenova/TinyLlama-1.1B-Chat-v1.0` for better quality
 *   at the cost of a larger download).
 *
 * Model files are fetched from HuggingFace on first use and cached in the
 * browser's Cache API by Transformers.js (`useBrowserCache` defaults true),
 * so the tutor works offline after the first successful load — exactly like
 * the Gemma GPU path.
 */
export const CPU_MODEL_ID: string =
  (typeof process !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_CPU_MODEL_ID === "string" &&
    process.env.NEXT_PUBLIC_CPU_MODEL_ID.trim()) ||
  "Xenova/Qwen1.5-0.5B-Chat";
