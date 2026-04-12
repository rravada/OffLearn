export type SubjectMode =
  | "mathematics"
  | "science"
  | "history"
  | "literature"
  | "programming"
  | "economics";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
  timestamp: number;
}

export interface KnowledgePack {
  id: string;
  title: string;
  subject: string;
  chunks: { id: string; text: string }[];
}

export interface MasteryEntry {
  concept: string;
  score: number;
  lastSeen: number;
}

export interface Chunk {
  id: string;
  text: string;
  packId: string;
}

export interface Session {
  id: string;
  startedAt: number;
  vaultId: string | null;
  title?: string;
  subjectMode?: SubjectMode;
}

export interface StoredMessage extends Message {
  sessionId: string;
}

export type ModelStatus = "idle" | "loading" | "ready" | "error";

export type MasteryBadge = "Novice" | "Developing" | "Mastered";

export function getMasteryBadge(score: number): MasteryBadge {
  if (score > 70) return "Mastered";
  if (score >= 40) return "Developing";
  return "Novice";
}

// Curriculum types

export interface CurriculumLesson {
  id: string;
  title: string;
  duration: string;
}

export interface CurriculumUnit {
  id: string;
  title: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumSubject {
  id: string;
  title: string;
  icon: string;
  units: CurriculumUnit[];
}

export interface CurriculumIndex {
  subjects: CurriculumSubject[];
}

export interface LessonSection {
  type: "explanation" | "example" | "keypoint";
  heading?: string;
  content: string;
}

export interface LessonData {
  id: string;
  title: string;
  subject: string;
  unit: string;
  duration: string;
  objectives: string[];
  sections: LessonSection[];
  aiContext: string;
}

// Test prep types

export type Difficulty = "easy" | "medium" | "hard";

export interface TestQuestion {
  id: string;
  test: string;
  section: string;
  difficulty: Difficulty;
  topic: string;
  question: string;
  passage?: string;
  options: string[];
  correct: number;
  explanation: string;
  aiHint: string;
}

export interface TestBank {
  questions: TestQuestion[];
}

// Navigation

export type AppMode = "learn" | "testprep";
