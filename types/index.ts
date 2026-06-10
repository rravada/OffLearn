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

export type CurriculumTrack = "standard" | "ap" | "college-prep";

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
  track?: CurriculumTrack;
  units: CurriculumUnit[];
}

export interface CurriculumIndex {
  subjects: CurriculumSubject[];
}

export type LessonSection =
  | { type: "explanation"; heading?: string; content: string }
  | { type: "example"; heading?: string; content: string }
  | { type: "keypoint"; heading?: string; content: string }
  | { type: "deepdive"; heading?: string; content: string }
  | { type: "steps"; heading?: string; steps: Array<{ title: string; content: string }> }
  | { type: "quiz"; question: string; options: string[]; correctIndex: number; explanation: string }
  | { type: "table"; heading?: string; headers: string[]; rows: string[][] }
  | { type: "callout"; variant: "warning" | "tip" | "remember"; heading?: string; content: string };

export interface LessonData {
  id: string;
  title: string;
  subject: string;
  unit: string;
  track?: "ap" | "college-prep";
  difficulty?: "ap" | "college-prep";
  duration: string;
  objectives: string[];
  sections: LessonSection[];
  aiContext: string;
}

// Assessment types

export interface AssessmentQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AssessmentData {
  id: string;
  title: string;
  subject: string;
  unit?: string;
  type: "unit-review" | "course-final";
  questionsPerAttempt: number;
  bank: AssessmentQuestion[];
  isAssessment: true;
}

export interface AssessmentResult {
  assessmentId: string;
  score: number;
  total: number;
  dateTaken: number;
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

// Teacher module types

export interface TeacherModuleEmbedding {
  id: string;
  text: string;
  embedding: number[];
}

export interface TeacherModule {
  id: string;
  title: string;
  subject: string;
  createdAt: number;
  pageCount: number;
  chunkCount: number;
  embeddings: TeacherModuleEmbedding[];
}

// Navigation

export type AppMode = "learn" | "testprep";
