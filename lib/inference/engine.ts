/**
 * Engine selector — the single seam between GPU and CPU inference paths.
 *
 * Callers import from here instead of directly from mediapipe.ts or
 * transformers.ts, which keeps the fallback logic in one place.
 *
 * Usage:
 *   const kind   = selectEngineKind();   // determined once at boot
 *   const engine = await getTutorEngine(onProgress);
 *   await engine.streamResponse(messages, onChunk, systemPrompt);
 *   closeTutorEngine();  // on new-conversation / unmount
 */

import { checkWebGPUSupport, LLMSession } from "@/lib/inference/mediapipe";
import { TransformersSession } from "@/lib/inference/transformers";
import type { EngineKind, InferenceEngine } from "@/types";

export type { EngineKind, InferenceEngine };

/** Which engine is currently (or will be) active. null before first boot. */
let activeKind: EngineKind | null = null;

/**
 * Determine which engine to use for this session.
 *
 * Defaults to "gpu" when WebGPU is present, "cpu" otherwise.
 * During development you can override via the `?engine=cpu` / `?engine=gpu`
 * query parameter so the CPU path is exercisable on a WebGPU machine.
 */
export function selectEngineKind(): EngineKind {
  if (typeof window !== "undefined") {
    const param = new URLSearchParams(window.location.search).get("engine");
    if (param === "cpu") return "cpu";
    if (param === "gpu") return "gpu";
  }
  return checkWebGPUSupport() ? "gpu" : "cpu";
}

/**
 * Boot (or return the already-booted) inference engine.
 * The engine kind is locked after the first call.
 */
export function getTutorEngine(
  onProgress?: (pct: number) => void
): Promise<InferenceEngine> {
  if (activeKind === null) {
    activeKind = selectEngineKind();
  }
  if (activeKind === "gpu") {
    return LLMSession.getInstance(onProgress);
  }
  return TransformersSession.getInstance(onProgress);
}

/** Tear down the active engine instance (new conversation / unmount). */
export function closeTutorEngine(): void {
  if (activeKind === "gpu") {
    LLMSession.closeInstance();
  } else if (activeKind === "cpu") {
    TransformersSession.closeInstance();
  }
  // Note: we intentionally do NOT reset activeKind here — once chosen for
  // the session the kind stays stable.
}

/** Which engine is active (null before first boot). */
export function getActiveEngineKind(): EngineKind | null {
  return activeKind;
}
