import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calculator,
  Microscope,
  Landmark,
  ScrollText,
  LineChart,
  Code2,
  Sigma,
  Dna,
  Atom,
} from "lucide-react";

/** Distinct icons per course id (Learn + sidebar). */
export const SUBJECT_ICON_MAP: Record<string, LucideIcon> = {
  math: Calculator,
  science: Microscope,
  history: Landmark,
  english: ScrollText,
  economics: LineChart,
  cs: Code2,
  "ap-calc-ab": Sigma,
  "ap-biology": Dna,
  "ap-chemistry": Atom,
};

export function getSubjectIcon(subjectId: string): LucideIcon {
  return SUBJECT_ICON_MAP[subjectId] ?? BookOpen;
}
