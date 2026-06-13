import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ARTIFACT_PATTERN =
  /<start_of_turn>(?:user|model)?\n?|<end_of_turn>\n?|<eos>|<bos>|<pad>/g;

export function stripArtifactTokens(text: string): string {
  return text.replace(ARTIFACT_PATTERN, "").trim();
}

export function cleanResponse(text: string): string {
  // Cut everything from the first turn boundary onward. Gemma will sometimes
  // keep generating past its own turn and start role-playing the student
  // (e.g. "<end_of_turn>\n<start_of_turn>user\u2026"). Truncating here is what stops
  // the model from talking to itself as both tutor and student.
  let out = text;
  const boundary = out.search(/<end_of_turn>|<start_of_turn>|<eos>|<\|/);
  if (boundary !== -1) {
    out = out.slice(0, boundary);
  }

  return out
    .replace(/\u200B|\uFEFF/g, "")
    // Model artifact tokens (in case any slipped through before the boundary)
    .replace(/<end_of_turn>/g, "")
    .replace(/<start_of_turn>/g, "")
    .replace(/\[INST\]/g, "")
    .replace(/\[\/INST\]/g, "")
    .replace(/<\|.*?\|>/g, "")
    .replace(/<eos>/g, "")
    .replace(/<bos>/g, "")
    .replace(/<pad>/g, "")
    // Strip a leading role label the model sometimes emits ("Tutor:", "model")
    .replace(/^\s*(?:model|tutor|assistant|student|user)\s*[:\-]?\s*/i, "")
    // LaTeX/math dollar delimiters \u2014 keep inner content, drop the $ wrappers
    .replace(/\$\$([^$]+)\$\$/gs, "$1")
    .replace(/\$([^$\n]+)\$/g, "$1")
    // Markdown bold and italic \u2014 keep inner text, drop the * wrappers
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    // Markdown headings, inline code backticks, and underscores-as-emphasis
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/`+/g, "")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, "$1$2")
    // Normalize markdown bullets (-, *) to a clean dot
    .replace(/^\s*[-*]\s+/gm, "\u2022 ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
