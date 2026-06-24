/**
 * CPU-side LLM inference engine using Transformers.js (WASM / onnxruntime-web).
 *
 * This is the fallback when WebGPU is unavailable. It exposes the same
 * `InferenceEngine` interface as `LLMSession` so call-sites need no changes.
 *
 * Transformers.js already ships in this project for RAG embeddings, so no new
 * top-level dependency is added. The model files are fetched from HuggingFace
 * on first use and cached via the browser Cache API (`useBrowserCache: true`,
 * the library default) — offline after first load, just like Gemma.
 */

import { cleanResponse } from "@/lib/utils";
import { CPU_MODEL_ID } from "@/lib/inference/transformersModelId";
import { GENERIC_TUTOR_PROMPT } from "@/lib/inference/tutorContext";
import type { InferenceEngine } from "@/types";

export class TransformersSession implements InferenceEngine {
  private static instance: TransformersSession | null = null;
  private static boot: Promise<TransformersSession> | null = null;

  // Typed loosely — TextGenerationPipeline is not cleanly exported in v2
  private pipe: ((input: unknown, opts: unknown) => Promise<unknown>) & {
    tokenizer: {
      apply_chat_template: (msgs: unknown, opts: unknown) => unknown;
      (text: string, opts: unknown): { input_ids: number[] };
      decode: (ids: number[], opts: unknown) => string;
    };
  } | null = null;

  private constructor() {}

  static getInstance(
    onProgress?: (pct: number) => void
  ): Promise<TransformersSession> {
    if (TransformersSession.instance?.pipe) {
      return Promise.resolve(TransformersSession.instance);
    }
    if (!TransformersSession.boot) {
      TransformersSession.boot = (async () => {
        const session = new TransformersSession();

        const { pipeline, env } = await import("@xenova/transformers");

        // Point onnxruntime-web to the self-hosted WASM files in /ort-wasm/.
        // These are copied from node_modules by the postinstall script.
        // Without an explicit path the library tries the CDN and may fail in
        // restricted environments (CSP, offline, corporate proxy, etc.).
        env.backends.onnx.wasm.wasmPaths = "/ort-wasm/";
        // Single-threaded avoids the SharedArrayBuffer / COOP+COEP header
        // requirement — important for a static-export site with no custom headers.
        env.backends.onnx.wasm.numThreads = 1;

        // Disable local-file loading — always fetch from HuggingFace.
        // useBrowserCache is true by default in-browser, so files are cached
        // for offline use after the first successful load.
        env.allowLocalModels = false;

        // Track cumulative per-file progress and report as 0-99 during load.
        let lastReported = 0;
        const progress_callback = (evt: {
          status: string;
          progress?: number;
        }) => {
          if (!onProgress) return;
          if (evt.status === "progress" && typeof evt.progress === "number") {
            const pct = Math.min(Math.round(evt.progress), 99);
            if (pct > lastReported) {
              lastReported = pct;
              onProgress(pct);
            }
          }
        };

        // The cast is necessary because Transformers.js v2 doesn't narrowly
        // type `pipeline()` return values based on the task string.
        session.pipe = (await pipeline("text-generation", CPU_MODEL_ID, {
          quantized: true,
          progress_callback,
        })) as typeof session.pipe;

        if (onProgress) onProgress(100);
        TransformersSession.instance = session;
        return session;
      })().catch((e) => {
        TransformersSession.boot = null;
        throw e;
      });
    }
    return TransformersSession.boot;
  }

  async streamResponse(
    messages: { role: "user" | "model"; content: string }[],
    onChunk: (text: string, done: boolean) => void,
    systemPrompt?: string
  ): Promise<string> {
    if (!this.pipe) throw new Error("CPU engine not initialized");

    const tok = this.pipe.tokenizer;
    const sysPrompt = systemPrompt ?? GENERIC_TUTOR_PROMPT;

    // Build HuggingFace chat format (system / user / assistant).
    // The pipeline auto-applies the model's chat template when passed an array.
    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] =
      [
        { role: "system", content: sysPrompt },
        ...messages.map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as
            | "user"
            | "assistant",
          content: m.content,
        })),
      ];

    // Compute prompt token count so streaming deltas begin after the prompt.
    // Mirror how the pipeline tokenizes: apply_chat_template → string → tokenizer.
    let promptLen = 0;
    try {
      const promptText = tok.apply_chat_template(chatMessages, {
        tokenize: false,
        add_generation_prompt: true,
      }) as string;
      const encoded = tok(promptText, {
        add_special_tokens: false,
        return_tensor: false,
      });
      const ids = encoded.input_ids;
      promptLen = Array.isArray(ids) ? ids.length : 0;
    } catch {
      // If prompt-length estimation fails, streaming starts from 0 and may
      // briefly include prompt tokens — acceptable, filtered by skip_special_tokens.
      promptLen = 0;
    }

    let lastEmittedLen = promptLen;
    let fullGenerated = "";

    await this.pipe(chatMessages, {
      max_new_tokens: 512,
      do_sample: true,
      temperature: 0.3,
      top_k: 40,
      callback_function: (beams: Array<{ output_token_ids: number[] }>) => {
        const ids = beams[0].output_token_ids;
        const newIds = ids.slice(lastEmittedLen);
        if (newIds.length > 0) {
          const delta = tok.decode(newIds, { skip_special_tokens: true });
          if (delta) {
            onChunk(delta, false);
            fullGenerated += delta;
          }
          // Advance even if delta was empty (e.g. a special token was consumed)
          lastEmittedLen = ids.length;
        }
      },
    });

    onChunk("", true);
    return cleanResponse(fullGenerated);
  }

  close(): void {
    // Transformers.js v2 pipelines don't expose a synchronous dispose —
    // clearing the reference is sufficient for GC.
    this.pipe = null;
    TransformersSession.instance = null;
    TransformersSession.boot = null;
  }

  static closeInstance(): void {
    if (TransformersSession.instance) {
      TransformersSession.instance.close();
    } else {
      TransformersSession.boot = null;
    }
  }
}
