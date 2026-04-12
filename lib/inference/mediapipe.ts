import {
  FilesetResolver,
  LlmInference,
  type ProgressListener,
} from "@mediapipe/tasks-genai";
import { getMeta, setMeta } from "@/lib/db/indexeddb";
import { cleanResponse } from "@/lib/utils";

const MODEL_PATH = "/models/gemma-4-E2B-it-web.task";
const WASM_PATH = "/mediapipe-wasm";
const MODEL_CACHED_KEY = "model_loaded";

const DEFAULT_SYSTEM_PROMPT = `You are a world-class Socratic tutor. A student will ask you questions.
NEVER give the direct answer. Instead, evaluate their current understanding
and ask ONE guiding question or provide ONE analogy that leads them
toward the answer. Keep responses under 120 words.`;

export function checkWebGPUSupport(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export class LLMSession {
  private static instance: LLMSession | null = null;
  private llm: LlmInference | null = null;

  private constructor() {}

  static async getInstance(
    onProgress?: (pct: number) => void
  ): Promise<LLMSession> {
    if (LLMSession.instance?.llm) {
      return LLMSession.instance;
    }

    const session = new LLMSession();

    const genai = await FilesetResolver.forGenAiTasks(WASM_PATH);

    const wasCached = await getMeta(MODEL_CACHED_KEY);

    if (wasCached && onProgress) {
      onProgress(100);
    }

    const device = await LlmInference.createWebGpuDevice();

    const llm = await LlmInference.createFromOptions(genai, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        gpuOptions: { device },
      },
      maxTokens: 1024,
      topK: 40,
      temperature: 0.8,
      randomSeed: 42,
    });

    await setMeta(MODEL_CACHED_KEY, "true");
    if (onProgress) onProgress(100);

    session.llm = llm;
    LLMSession.instance = session;
    return session;
  }

  async streamResponse(
    prompt: string,
    onChunk: (text: string, done: boolean) => void,
    systemPrompt?: string
  ): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    const sysPrompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const fullPrompt = `<start_of_turn>user\n${sysPrompt}\n\n${prompt}<end_of_turn>\n<start_of_turn>model\n`;

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
  }
}
