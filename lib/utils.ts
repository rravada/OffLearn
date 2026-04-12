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
  return text
    .replace(/<end_of_turn>/g, "")
    .replace(/<start_of_turn>/g, "")
    .replace(/\[INST\]/g, "")
    .replace(/\[\/INST\]/g, "")
    .replace(/<\|.*?\|>/g, "")
    .replace(/<eos>/g, "")
    .replace(/<bos>/g, "")
    .replace(/<pad>/g, "")
    .trim();
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
