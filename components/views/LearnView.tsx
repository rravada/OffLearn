"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import type { CurriculumIndex, CurriculumSubject, CurriculumUnit, LessonData } from "@/types";
import {
  BookOpen,
  Clock,
  ChevronRight,
  Sparkles,
  Key,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LearnViewProps {
  curriculum: CurriculumIndex;
  selectedSubject: string | null;
}

type ViewState =
  | { mode: "browse" }
  | { mode: "lesson"; subject: CurriculumSubject; unit: CurriculumUnit; lessonIdx: number; data: LessonData };

function lessonCacheKey(subject: CurriculumSubject, unit: CurriculumUnit, lessonId: string) {
  return `${subject.id}/${unit.id}/${lessonId}`;
}

export function LearnView({ curriculum, selectedSubject }: LearnViewProps) {
  const [viewState, setViewState] = useState<ViewState>({ mode: "browse" });
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const lessonCache = useRef<Map<string, LessonData>>(new Map());
  const {
    setTutorOpen,
    setTutorSystemPrompt,
    clearTutorMessages,
    tutorOpen,
  } = useAppStore();

  const filteredSubjects = selectedSubject
    ? curriculum.subjects.filter((s) => s.id === selectedSubject)
    : curriculum.subjects;

  const prefetchLesson = useCallback(
    (subject: CurriculumSubject, unit: CurriculumUnit, lessonIdx: number) => {
      const lesson = unit.lessons[lessonIdx];
      const key = lessonCacheKey(subject, unit, lesson.id);
      if (lessonCache.current.has(key)) return;
      const url = `/curriculum/${subject.id}/${unit.id}/${lesson.id}.json`;
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error("prefetch failed");
          return r.json() as Promise<LessonData>;
        })
        .then((data) => {
          lessonCache.current.set(key, data);
        })
        .catch(() => {});
    },
    []
  );

  const openLesson = useCallback(
    async (subject: CurriculumSubject, unit: CurriculumUnit, lessonIdx: number) => {
      const lesson = unit.lessons[lessonIdx];
      const key = lessonCacheKey(subject, unit, lesson.id);
      const cached = lessonCache.current.get(key);
      if (cached) {
        setViewState({ mode: "lesson", subject, unit, lessonIdx, data: cached });
        clearTutorMessages();
        return;
      }

      setOpeningKey(key);
      try {
        const res = await fetch(`/curriculum/${subject.id}/${unit.id}/${lesson.id}.json`);
        if (!res.ok) throw new Error("Lesson not found");
        const data = (await res.json()) as LessonData;
        lessonCache.current.set(key, data);
        setViewState({ mode: "lesson", subject, unit, lessonIdx, data });
        clearTutorMessages();
      } catch (err) {
        console.error("Failed to load lesson:", err);
      } finally {
        setOpeningKey(null);
      }
    },
    [clearTutorMessages]
  );

  const openTutor = useCallback(() => {
    if (viewState.mode !== "lesson") return;
    const { data } = viewState;
    const systemPrompt = `You are a Socratic tutor helping a high school student understand: ${data.title} in ${data.subject} — ${data.unit}.

Lesson context: ${data.aiContext}

Rules:
- Only answer questions related to this lesson topic
- Never give direct answers — guide with questions and analogies
- If the student answers correctly, confirm warmly and explain why
- If the student answers incorrectly, redirect with a new guiding question
- If asked something outside this lesson, say: 'Let us stay focused on ${data.title} for now — what part is confusing you?'
- Adapt length to complexity. Never truncate mid-explanation.`;
    setTutorSystemPrompt(systemPrompt);
    setTutorOpen(true);
  }, [viewState, setTutorSystemPrompt, setTutorOpen]);

  const goToNextLesson = useCallback(() => {
    if (viewState.mode !== "lesson") return;
    const { subject, unit, lessonIdx } = viewState;
    if (lessonIdx + 1 < unit.lessons.length) {
      openLesson(subject, unit, lessonIdx + 1);
    }
  }, [viewState, openLesson]);

  const goBack = useCallback(() => {
    setViewState({ mode: "browse" });
    setTutorOpen(false);
  }, [setTutorOpen]);

  useEffect(() => {
    setViewState((prev) =>
      prev.mode === "lesson" ? { mode: "browse" } : prev
    );
  }, [selectedSubject]);

  if (viewState.mode === "lesson") {
    const { data, subject, unit, lessonIdx } = viewState;
    const totalLessons = unit.lessons.length;
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b border-le-border bg-le-surface/50 px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="rounded-md p-1.5 text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm text-le-text-secondary">
              <span>{subject.title}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{unit.title}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <p className="label-badge text-le-accent">
              Lesson {lessonIdx + 1} of {totalLessons}
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-le-elevated">
              <div
                className="h-full rounded-full bg-le-accent transition-all"
                style={{ width: `${((lessonIdx + 1) / totalLessons) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto max-w-[680px]">
            <h1 className="heading text-3xl text-le-text">{data.title}</h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-le-text-secondary">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {data.duration}
              </span>
            </div>

            {data.objectives.length > 0 && (
              <div className="mt-6 rounded-lg border border-le-border bg-le-surface p-4">
                <p className="label-badge mb-2 text-le-text-hint">Learning Objectives</p>
                <ul className="space-y-1">
                  {data.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-le-text-secondary">
                      <span className="mt-0.5 text-le-accent">•</span>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 space-y-8">
              {data.sections.map((section, i) => {
                if (section.type === "explanation") {
                  return (
                    <div key={i}>
                      {section.heading && (
                        <h2 className="heading mb-3 text-xl text-le-text">{section.heading}</h2>
                      )}
                      <div className="lesson-prose whitespace-pre-line text-le-text/90">
                        {section.content}
                      </div>
                    </div>
                  );
                }
                if (section.type === "example") {
                  return (
                    <div
                      key={i}
                      className="rounded-lg border-l-4 border-le-accent bg-le-surface/50 px-6 py-5"
                    >
                      {section.heading && (
                        <h3 className="heading mb-3 text-base text-le-accent">{section.heading}</h3>
                      )}
                      <div className="whitespace-pre-line font-mono text-sm leading-relaxed text-le-text/85">
                        {section.content}
                      </div>
                    </div>
                  );
                }
                if (section.type === "keypoint") {
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg bg-le-accent-soft px-6 py-5"
                    >
                      <Key className="mt-0.5 h-5 w-5 flex-shrink-0 text-le-accent" />
                      <p className="text-[15px] font-semibold leading-relaxed text-le-text">
                        {section.content}
                      </p>
                    </div>
                  );
                }
                if (section.type === "deepdive") {
                  return (
                    <div
                      key={i}
                      className="rounded-lg border-l-4 border-indigo-500/80 bg-indigo-950/20 px-5 py-4 dark:bg-indigo-950/30"
                    >
                      {section.heading && (
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
                          Going deeper
                        </p>
                      )}
                      <div className="lesson-prose whitespace-pre-line text-sm text-le-text/90">
                        {section.content}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <div className="mt-12 flex items-center justify-between border-t border-le-border pt-8 pb-16">
              {lessonIdx + 1 < totalLessons ? (
                <button
                  type="button"
                  onClick={goToNextLesson}
                  className="flex items-center gap-2 rounded-xl bg-le-accent px-6 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110"
                >
                  Next lesson
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <p className="text-sm text-le-text-secondary">
                  You have completed all lessons in {unit.title}!
                </p>
              )}
            </div>
          </div>
        </div>

        {!tutorOpen && (
          <button
            type="button"
            onClick={openTutor}
            className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-le-accent px-5 py-3 text-sm font-semibold text-le-bg shadow-lg shadow-le-accent/25 transition-all hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" />
            Ask the AI tutor
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="heading text-2xl text-le-text">
          {selectedSubject ? filteredSubjects[0]?.title : "All Subjects"}
        </h1>
        <p className="mt-1 text-sm text-le-text-secondary">
          Choose a lesson to start learning
        </p>

        <div className="mt-8 space-y-8">
          {filteredSubjects.map((subject) => (
            <div key={subject.id}>
              {!selectedSubject && (
                <h2 className="heading mb-4 text-lg text-le-text">{subject.title}</h2>
              )}
              {subject.units.map((unit) => (
                <div key={unit.id} className="mb-6">
                  <h3 className="label-badge mb-3 text-le-text-hint">{unit.title}</h3>
                  <div className="space-y-2">
                    {unit.lessons.map((lesson, lessonIdx) => {
                      const rowKey = lessonCacheKey(subject, unit, lesson.id);
                      const isOpening = openingKey === rowKey;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          disabled={!!openingKey}
                          onMouseEnter={() => prefetchLesson(subject, unit, lessonIdx)}
                          onFocus={() => prefetchLesson(subject, unit, lessonIdx)}
                          onClick={() => openLesson(subject, unit, lessonIdx)}
                          className={cn(
                            "group flex w-full items-center gap-4 rounded-xl border border-le-border bg-le-surface px-5 py-4 text-left transition-all hover:border-le-border-strong hover:bg-le-elevated",
                            isOpening && "border-le-accent/50 bg-le-elevated",
                            openingKey && !isOpening && "pointer-events-none opacity-60"
                          )}
                        >
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-le-accent-soft">
                            {isOpening ? (
                              <Loader2 className="h-5 w-5 animate-spin text-le-accent" />
                            ) : (
                              <BookOpen className="h-5 w-5 text-le-accent" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-le-text group-hover:text-le-accent transition-colors">
                              {lesson.title}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-le-text-hint">
                              <Clock className="h-3 w-3" />
                              {lesson.duration}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-le-text-hint group-hover:text-le-accent transition-colors" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
