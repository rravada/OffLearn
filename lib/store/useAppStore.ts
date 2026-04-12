import { create } from "zustand";
import type {
  Message,
  ModelStatus,
  AppMode,
  LessonData,
  TestQuestion,
} from "@/types";

interface AppState {
  modelStatus: ModelStatus;
  modelProgress: number;
  modelError: string | null;

  hasVisited: boolean;
  appMode: AppMode;
  selectedSubject: string | null;

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
  tutorSystemPrompt: string;
  isTutorGenerating: boolean;
  tutorStreamingContent: string;

  // Model
  isGenerating: boolean;

  // Actions
  setModelStatus: (status: ModelStatus) => void;
  setModelProgress: (progress: number) => void;
  setModelError: (error: string | null) => void;

  setHasVisited: (v: boolean) => void;
  setAppMode: (mode: AppMode) => void;
  setSelectedSubject: (subject: string | null) => void;

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
  setTutorSystemPrompt: (prompt: string) => void;
  setIsTutorGenerating: (v: boolean) => void;
  setTutorStreamingContent: (content: string) => void;
  appendTutorStreamingContent: (chunk: string) => void;

  setIsGenerating: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  modelStatus: "idle",
  modelProgress: 0,
  modelError: null,

  hasVisited: false,
  appMode: "learn",
  selectedSubject: null,

  currentLesson: null,

  currentTestBank: [],
  currentQuestionIndex: 0,
  selectedAnswer: null,
  answeredCorrectly: null,
  testAnswers: {},
  testComplete: false,

  tutorOpen: false,
  tutorMessages: [],
  tutorSystemPrompt: "",
  isTutorGenerating: false,
  tutorStreamingContent: "",

  isGenerating: false,

  setModelStatus: (status) => set({ modelStatus: status }),
  setModelProgress: (progress) => set({ modelProgress: progress }),
  setModelError: (error) => set({ modelError: error }),

  setHasVisited: (v) => set({ hasVisited: v }),
  setAppMode: (mode) => set({ appMode: mode }),
  setSelectedSubject: (subject) => set({ selectedSubject: subject }),

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
  setTutorSystemPrompt: (prompt) => set({ tutorSystemPrompt: prompt }),
  setIsTutorGenerating: (v) => set({ isTutorGenerating: v }),
  setTutorStreamingContent: (content) => set({ tutorStreamingContent: content }),
  appendTutorStreamingContent: (chunk) =>
    set((state) => ({ tutorStreamingContent: state.tutorStreamingContent + chunk })),

  setIsGenerating: (v) => set({ isGenerating: v }),
}));
