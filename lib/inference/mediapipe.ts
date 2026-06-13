import {
  FilesetResolver,
  LlmInference,
  type ProgressListener,
} from "@mediapipe/tasks-genai";
import { getMeta, setMeta } from "@/lib/db/indexeddb";
import { cleanResponse } from "@/lib/utils";
import { GEMMA_MODEL_ASSET_URL } from "@/lib/inference/gemmaModelUrl";
const WASM_PATH = "/mediapipe-wasm";
const MODEL_CACHED_KEY = "model_loaded";

const DEFAULT_SYSTEM_PROMPT = `You are a friendly, clear tutor helping a high school student.
Answer the student's question directly and correctly first, explained in simple terms.
Ask at most one short follow-up question, and only when it genuinely helps — do NOT end every reply with a question.
Keep replies concise: usually 2 to 5 sentences. Stop once the question is answered.
Write in plain English sentences only. Do not use markdown, asterisks, headings, bullet symbols, or LaTeX.
Respond only in English. Never write as the student or invent a back-and-forth — reply once and stop.`;

export function checkWebGPUSupport(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 3, delayMs = 400): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}

export class LLMSession {
  private static instance: LLMSession | null = null;
  /** Single in-flight boot; cleared on failure so callers can retry. */
  private static boot: Promise<LLMSession> | null = null;
  private llm: LlmInference | null = null;

  private constructor() {}

  static getInstance(onProgress?: (pct: number) => void): Promise<LLMSession> {
    if (LLMSession.instance?.llm) {
      return Promise.resolve(LLMSession.instance);
    }
    if (!LLMSession.boot) {
      LLMSession.boot = (async () => {
        const session = new LLMSession();

        const genai = await FilesetResolver.forGenAiTasks(WASM_PATH);

        const wasCached = await getMeta(MODEL_CACHED_KEY);

        if (wasCached && onProgress) {
          onProgress(100);
        }

        const device = await withRetries(() => LlmInference.createWebGpuDevice(), 3, 500);

        const llm = await withRetries(
          () =>
            LlmInference.createFromOptions(genai, {
              baseOptions: {
                modelAssetPath: GEMMA_MODEL_ASSET_URL,
                gpuOptions: { device },
              },
              maxTokens: 1024,
              topK: 40,
              temperature: 0.3,
              randomSeed: 42,
            }),
          2,
          600
        );

        await setMeta(MODEL_CACHED_KEY, "true");
        if (onProgress) onProgress(100);

        session.llm = llm;
        LLMSession.instance = session;
        return session;
      })().catch((e) => {
        LLMSession.boot = null;
        throw e;
      });
    }
    return LLMSession.boot;
  }

  async streamResponse(
    messages: { role: "user" | "model"; content: string }[],
    onChunk: (text: string, done: boolean) => void,
    systemPrompt?: string
  ): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    const sysPrompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    // Put the system instructions + lesson grounding in their own preamble
    // exchange rather than gluing them onto the first user message. The caller
    // rebuilds `sysPrompt` (with fresh retrieved context) on every send, so the
    // grounding always reflects the latest question — even mid-conversation.
    let fullPrompt = "";
    if (sysPrompt) {
      fullPrompt += `<start_of_turn>user\n${sysPrompt}<end_of_turn>\n`;
      fullPrompt += `<start_of_turn>model\nGot it — I'll help with this lesson.<end_of_turn>\n`;
    }
    for (const { role, content } of messages) {
      if (role === "user") {
        fullPrompt += `<start_of_turn>user\n${content}<end_of_turn>\n`;
      } else {
        fullPrompt += `<start_of_turn>model\n${content}<end_of_turn>\n`;
      }
    }
    fullPrompt += `<start_of_turn>model\n`;

    const listener: ProgressListener = (partialResult, done) => {
      onChunk(partialResult, done);
    };

    const result = await this.llm.generateResponse(fullPrompt, listener);
    return cleanResponse(result);
  }

  async generateWithImage(
    textPrompt: string,
    imageBase64: string,
    onChunk: (text: string, done: boolean) => void,
    systemPrompt?: string
  ): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    const sysPrompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    const listener: ProgressListener = (partialResult, done) => {
      onChunk(partialResult, done);
    };

    const result = await this.llm.generateResponse(
      [
        `<start_of_turn>user\n${sysPrompt}\n\n`,
        { imageSource: imageBase64 },
        `\n${textPrompt}<end_of_turn>\n<start_of_turn>model\n`,
      ],
      listener
    );
    return cleanResponse(result);
  }

  close(): void {
    this.llm?.close();
    this.llm = null;
    LLMSession.instance = null;
    LLMSession.boot = null;
  }

  /** Destroy the singleton without needing to await getInstance() first. */
  static closeInstance(): void {
    if (LLMSession.instance) {
      LLMSession.instance.close();
    } else {
      LLMSession.boot = null;
    }
  }
}
