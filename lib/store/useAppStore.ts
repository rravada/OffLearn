import { create } from "zustand";
import type {
  Message,
  ModelStatus,
  EngineKind,
  AppMode,
  LessonData,
  TestQuestion,
} from "@/types";

interface AppState {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;

  modelStatus: ModelStatus;
  modelProgress: number;
  modelError: string | null;
  modelEngine: EngineKind | null;

  hasVisited: boolean;
  appMode: AppMode;
  selectedSubject: string | null;

  // Local profiles (per-device, no auth)
  activeProfileId: string | null;
  /** Bumped whenever progress/profile data changes so views re-read from IndexedDB. */
  progressVersion: number;

  // Lesson state
  currentLesson: LessonData | null;

  // Test prep state
  currentTestBank: TestQuestion[];
  currentQuestionIndex: number;
  selectedAnswer: number | null;
  answeredCorrectly: boolean | null;
  testAnswers: Record<number, { selected: number; correct: boolean }>;
  testComplete: boolean;

  // AI Tutor panel
  tutorOpen: boolean;
  tutorMessages: Message[];
  currentSessionId: string | null;
  tutorSystemPrompt: string;
  isTutorGenerating: boolean;
  tutorStreamingContent: string;

  // Model
  isGenerating: boolean;

  // Actions
  setModelStatus: (status: ModelStatus) => void;
  setModelProgress: (progress: number) => void;
  setModelError: (error: string | null) => void;
  setModelEngine: (engine: EngineKind | null) => void;

  setHasVisited: (v: boolean) => void;
  setAppMode: (mode: AppMode) => void;
  setSelectedSubject: (subject: string | null) => void;

  setActiveProfileId: (id: string | null) => void;
  bumpProgress: () => void;

  setCurrentLesson: (lesson: LessonData | null) => void;

  setCurrentTestBank: (questions: TestQuestion[]) => void;
  setCurrentQuestionIndex: (idx: number) => void;
  setSelectedAnswer: (idx: number | null) => void;
  setAnsweredCorrectly: (v: boolean | null) => void;
  recordTestAnswer: (questionIdx: number, selected: number, correct: boolean) => void;
  setTestComplete: (v: boolean) => void;
  resetTestSession: () => void;

  setTutorOpen: (open: boolean) => void;
  addTutorMessage: (msg: Message) => void;
  clearTutorMessages: () => void;
  setTutorMessages: (msgs: Message[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  setTutorSystemPrompt: (prompt: string) => void;
  setIsTutorGenerating: (v: boolean) => void;
  setTutorStreamingContent: (content: string) => void;
  appendTutorStreamingContent: (chunk: string) => void;

  setIsGenerating: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: (typeof window !== "undefined"
    ? (localStorage.getItem("offlearn-theme") as "dark" | "light") ?? "dark"
    : "dark"),
  setTheme: (t) => {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("offlearn-theme", t); } catch (_) { /* noop */ }
    set({ theme: t });
  },

  modelStatus: "idle",
  modelProgress: 0,
  modelError: null,
  modelEngine: null,

  hasVisited: false,
  appMode: "dashboard",
  selectedSubject: null,

  activeProfileId: null,
  progressVersion: 0,

  currentLesson: null,

  currentTestBank: [],
  currentQuestionIndex: 0,
  selectedAnswer: null,
  answeredCorrectly: null,
  testAnswers: {},
  testComplete: false,

  tutorOpen: false,
  tutorMessages: [],
  currentSessionId: null,
  tutorSystemPrompt: "",
  isTutorGenerating: false,
  tutorStreamingContent: "",

  isGenerating: false,

  setModelStatus: (status) => set({ modelStatus: status }),
  setModelProgress: (progress) => set({ modelProgress: progress }),
  setModelError: (error) => set({ modelError: error }),
  setModelEngine: (engine) => set({ modelEngine: engine }),

  setHasVisited: (v) => set({ hasVisited: v }),
  setAppMode: (mode) => set({ appMode: mode }),
  setSelectedSubject: (subject) => set({ selectedSubject: subject }),

  setActiveProfileId: (id) => set({ activeProfileId: id }),
  bumpProgress: () => set((state) => ({ progressVersion: state.progressVersion + 1 })),

  setCurrentLesson: (lesson) => set({ currentLesson: lesson }),

  setCurrentTestBank: (questions) => set({ currentTestBank: questions }),
  setCurrentQuestionIndex: (idx) => set({ currentQuestionIndex: idx }),
  setSelectedAnswer: (idx) => set({ selectedAnswer: idx }),
  setAnsweredCorrectly: (v) => set({ answeredCorrectly: v }),
  recordTestAnswer: (questionIdx, selected, correct) =>
    set((state) => ({
      testAnswers: { ...state.testAnswers, [questionIdx]: { selected, correct } },
    })),
  setTestComplete: (v) => set({ testComplete: v }),
  resetTestSession: () =>
    set({
      currentTestBank: [],
      currentQuestionIndex: 0,
      selectedAnswer: null,
      answeredCorrectly: null,
      testAnswers: {},
      testComplete: false,
    }),

  setTutorOpen: (open) => set({ tutorOpen: open }),
  addTutorMessage: (msg) =>
    set((state) => ({ tutorMessages: [...state.tutorMessages, msg] })),
  clearTutorMessages: () => set({ tutorMessages: [] }),
  setTutorMessages: (msgs) => set({ tutorMessages: msgs }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setTutorSystemPrompt: (prompt) => set({ tutorSystemPrompt: prompt }),
  setIsTutorGenerating: (v) => set({ isTutorGenerating: v }),
  setTutorStreamingContent: (content) => set({ tutorStreamingContent: content }),
  appendTutorStreamingContent: (chunk) =>
    set((state) => ({ tutorStreamingContent: state.tutorStreamingContent + chunk })),

  setIsGenerating: (v) => set({ isGenerating: v }),
}));
