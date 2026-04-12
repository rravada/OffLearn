"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import type {
  CurriculumIndex,
  CurriculumLesson,
  CurriculumSubject,
  CurriculumUnit,
  LessonData,
} from "@/types";
import {
  Clock,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Key,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSubjectIcon } from "@/lib/subjectIcons";

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

function safeUnits(subject: CurriculumSubject): CurriculumUnit[] {
  return Array.isArray(subject.units) ? subject.units : [];
}

function safeLessons(unit: CurriculumUnit): CurriculumLesson[] {
  return Array.isArray(unit.lessons) ? unit.lessons : [];
}

export function LearnView({ curriculum, selectedSubject }: LearnViewProps) {
  const [viewState, setViewState] = useState<ViewState>({ mode: "browse" });
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  /** Bumps when entering a lesson so the main panel scroll resets (incl. reopening same lesson). */
  const [lessonScrollEpoch, setLessonScrollEpoch] = useState(0);
  const lessonTopRef = useRef<HTMLDivElement>(null);
  const lessonCache = useRef<Map<string, LessonData>>(new Map());
  const {
    setTutorOpen,
    setTutorSystemPrompt,
    clearTutorMessages,
    tutorOpen,
  } = useAppStore();

  const subjectsList = useMemo(
    () => (Array.isArray(curriculum.subjects) ? curriculum.subjects : []),
    [curriculum.subjects]
  );

  const filteredSubjects = selectedSubject
    ? subjectsList.filter((s) => s.id === selectedSubject)
    : subjectsList;

  const [browseSearch, setBrowseSearch] = useState("");

  const searchNorm = browseSearch.trim().toLowerCase();

  const displaySubjects = useMemo(() => {
    if (!searchNorm) return filteredSubjects;

    if (!selectedSubject) {
      return filteredSubjects.filter(
        (s) =>
          s.title.toLowerCase().includes(searchNorm) ||
          s.id.toLowerCase().includes(searchNorm)
      );
    }

    return filteredSubjects
      .map((s) => ({
        ...s,
        units: safeUnits(s).filter(
          (u) =>
            u.title.toLowerCase().includes(searchNorm) ||
            safeLessons(u).some((l) => l.title.toLowerCase().includes(searchNorm))
        ),
      }))
      .filter((s) => s.units.length > 0);
  }, [filteredSubjects, selectedSubject, searchNorm]);

  const prefetchLesson = useCallback(
    (subject: CurriculumSubject, unit: CurriculumUnit, lessonIdx: number) => {
      const lesson = safeLessons(unit)[lessonIdx];
      if (!lesson) return;
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

  /** Fill lesson memory cache during idle time so offline / later lessons work without hovering first. */
  useEffect(() => {
    const win = typeof window !== "undefined" ? window : null;
    if (!win) return;
    let cancelled = false;
    const warm = async () => {
      const jobs: Array<{
        s: CurriculumSubject;
        u: CurriculumUnit;
        i: number;
      }> = [];
      for (const s of subjectsList) {
        for (const u of safeUnits(s)) {
          const lessons = safeLessons(u);
          for (let i = 0; i < lessons.length; i++) {
            jobs.push({ s, u, i });
          }
        }
      }
      const batch = 16;
      for (let o = 0; o < jobs.length; o += batch) {
        if (cancelled) return;
        const slice = jobs.slice(o, o + batch);
        slice.forEach(({ s, u, i }) => prefetchLesson(s, u, i));
        await new Promise((r) => setTimeout(r, 0));
      }
    };

    const start = () => {
      if (cancelled) return;
      void warm();
    };

    let idleHandle: number;
    if ("requestIdleCallback" in win) {
      idleHandle = win.requestIdleCallback(start, { timeout: 120_000 });
    } else {
      idleHandle = setTimeout(start, 400) as unknown as number;
    }

    return () => {
      cancelled = true;
      if ("cancelIdleCallback" in win) {
        win.cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }
    };
  }, [subjectsList, prefetchLesson]);

  const openLesson = useCallback(
    async (subject: CurriculumSubject, unit: CurriculumUnit, lessonIdx: number) => {
      const lesson = safeLessons(unit)[lessonIdx];
      if (!lesson) return;
      const key = lessonCacheKey(subject, unit, lesson.id);
      const cached = lessonCache.current.get(key);
      if (cached) {
        setLessonScrollEpoch((n) => n + 1);
        setViewState({ mode: "lesson", subject, unit, lessonIdx, data: cached });
        clearTutorMessages();
        return;
      }

      const controller = new AbortController();
      const t = window.setTimeout(() => controller.abort(), 90_000);

      setOpeningKey(key);
      try {
        const res = await fetch(
          `/curriculum/${subject.id}/${unit.id}/${lesson.id}.json`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Lesson not found");
        const data = (await res.json()) as LessonData;
        lessonCache.current.set(key, data);
        setLessonScrollEpoch((n) => n + 1);
        setViewState({ mode: "lesson", subject, unit, lessonIdx, data });
        clearTutorMessages();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to load lesson:", err);
        }
      } finally {
        window.clearTimeout(t);
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
    if (lessonIdx + 1 < safeLessons(unit).length) {
      openLesson(subject, unit, lessonIdx + 1);
    }
  }, [viewState, openLesson]);

  const goToPreviousLesson = useCallback(() => {
    if (viewState.mode !== "lesson") return;
    const { subject, unit, lessonIdx } = viewState;
    if (lessonIdx > 0) {
      openLesson(subject, unit, lessonIdx - 1);
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

  useLayoutEffect(() => {
    if (viewState.mode !== "lesson") return;

    const scrollMainToLessonStart = () => {
      const main = document.querySelector("main.main-scroll-panel");
      if (main) {
        main.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      lessonTopRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    };

    scrollMainToLessonStart();
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollMainToLessonStart);
    });
    const t = window.setTimeout(scrollMainToLessonStart, 0);
    const t2 = window.setTimeout(scrollMainToLessonStart, 100);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [lessonScrollEpoch, viewState.mode]);

  if (viewState.mode === "lesson") {
    const { data, subject, unit, lessonIdx } = viewState;
    const unitLessons = safeLessons(unit);
    const totalLessons = unitLessons.length;
    const objectives = Array.isArray(data.objectives) ? data.objectives : [];
    const sections = Array.isArray(data.sections) ? data.sections : [];
    return (
      <div className="flex w-full flex-col">
        <div className="sticky top-0 z-20 border-b border-le-border bg-le-surface/95 px-8 py-4 backdrop-blur-sm">
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
                className="h-full rounded-full bg-gradient-to-r from-le-mint/90 to-le-accent transition-all"
                style={{ width: `${((lessonIdx + 1) / totalLessons) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="px-8 pb-16 pt-6">
          <div className="mx-auto max-w-[680px]">
            <h1 ref={lessonTopRef} className="heading text-3xl text-le-text">
              {data.title}
            </h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-le-text-secondary">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {data.duration}
              </span>
            </div>

            {objectives.length > 0 && (
              <div className="mt-6 rounded-lg border border-le-border bg-le-surface p-4">
                <p className="label-badge mb-2 text-le-text-hint">Learning Objectives</p>
                <ul className="space-y-1">
                  {objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-le-text-secondary">
                      <span className="mt-0.5 text-le-accent">•</span>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 space-y-8">
              {sections.map((section, i) => {
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

            <div className="mt-12 flex flex-col gap-4 border-t border-le-border pt-8 pb-16 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {lessonIdx > 0 ? (
                  <button
                    type="button"
                    onClick={goToPreviousLesson}
                    className="flex items-center gap-2 rounded-xl border border-le-border bg-le-surface px-6 py-3 text-sm font-medium text-le-text transition-colors hover:bg-le-elevated"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous lesson
                  </button>
                ) : (
                  <span className="inline-block min-h-[44px] min-w-[1px]" aria-hidden />
                )}
              </div>
              <div className="sm:text-right">
                {lessonIdx + 1 < totalLessons ? (
                  <button
                    type="button"
                    onClick={goToNextLesson}
                    className="flex items-center gap-2 rounded-xl bg-le-accent px-6 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110 sm:ml-auto sm:inline-flex"
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
    <div className="w-full px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="heading text-2xl text-le-text">
          {selectedSubject ? filteredSubjects[0]?.title : "All Subjects"}
        </h1>
        <p className="mt-1 text-sm text-le-text-secondary">
          Start each unit from lesson 1, or open the list below to jump to another lesson.
        </p>

        <div className="relative mt-6">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-le-text-hint"
            aria-hidden
          />
          <input
            type="search"
            value={browseSearch}
            onChange={(e) => setBrowseSearch(e.target.value)}
            placeholder={
              selectedSubject
                ? "Search units and lessons in this subject…"
                : "Search subjects (e.g. Calculus, Biology, English)…"
            }
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-le-border bg-le-surface/90 py-2.5 pl-10 pr-10 text-sm text-le-text shadow-sm outline-none ring-le-mint/30 transition-[box-shadow,border-color] placeholder:text-le-text-hint focus:border-le-mint/40 focus:ring-2"
            aria-label={selectedSubject ? "Search units and lessons" : "Search subjects"}
          />
          {browseSearch ? (
            <button
              type="button"
              onClick={() => setBrowseSearch("")}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-le-text-hint transition-colors hover:bg-le-hover hover:text-le-text"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-8 space-y-8">
          {displaySubjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-le-border bg-le-surface/50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-le-text">No matches</p>
              <p className="mt-1 text-sm text-le-text-secondary">
                Try a different term or clear the search.
              </p>
              <button
                type="button"
                onClick={() => setBrowseSearch("")}
                className="mt-4 text-sm font-medium text-le-accent hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            displaySubjects.map((subject) => {
              const SubjectGlyph = getSubjectIcon(subject.id);
              return (
                <div key={subject.id}>
                  {!selectedSubject && (
                    <h2 className="heading mb-4 flex items-center gap-2 text-lg text-le-text">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-le-accent-soft/80 ring-1 ring-le-mint/20">
                        <SubjectGlyph className="h-4 w-4 text-le-mint" />
                      </span>
                      {subject.title}
                    </h2>
                  )}
                  {safeUnits(subject).map((unit) => {
                    const ul = safeLessons(unit);
                    const firstLesson = ul[0];
                    if (!firstLesson) return null;
                    const startRowKey = lessonCacheKey(subject, unit, firstLesson.id);
                    const isOpeningStart = openingKey === startRowKey;
                    const total = ul.length;
                    const moreCount = total - 1;
                    return (
                      <div key={unit.id} className="mb-6">
                        <h3 className="label-badge mb-3 text-le-text-hint">{unit.title}</h3>
                        <div className="space-y-2">
                          <button
                            type="button"
                            disabled={!!openingKey}
                            onClick={() => openLesson(subject, unit, 0)}
                            className={cn(
                              "group flex w-full items-center gap-4 rounded-xl border border-le-border bg-le-surface/80 px-5 py-4 text-left shadow-sm transition-all hover:border-le-mint/35 hover:bg-le-elevated hover:shadow-[0_0_0_1px_rgba(94,234,212,0.12)]",
                              isOpeningStart && "border-le-accent/50 bg-le-elevated",
                              openingKey && !isOpeningStart && "pointer-events-none opacity-60"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-le-accent-soft to-le-mint/10 ring-1 ring-white/5"
                              )}
                            >
                              {isOpeningStart ? (
                                <Loader2 className="h-5 w-5 animate-spin text-le-accent" />
                              ) : (
                                <SubjectGlyph className="h-5 w-5 text-le-accent" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-[11px] font-semibold uppercase tracking-label text-le-mint">
                                Start here · Lesson 1 of {total}
                              </p>
                              <p className="text-sm font-medium text-le-text group-hover:text-le-accent transition-colors">
                                {firstLesson.title}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-le-text-hint">
                                <Clock className="h-3 w-3" />
                                {firstLesson.duration}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-le-text-hint group-hover:text-le-accent transition-colors" />
                          </button>

                          {ul.length > 1 ? (
                            <details className="group/details rounded-xl border border-le-border/80 bg-le-bg/40 open:border-le-border open:bg-le-surface/60">
                              <summary
                                className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors marker:content-none hover:bg-le-hover/60 [&::-webkit-details-marker]:hidden"
                                aria-label={`${moreCount} more ${moreCount === 1 ? "lesson" : "lessons"} in this unit`}
                              >
                                <span className="text-sm text-le-text-secondary">
                                  {moreCount} more{" "}
                                  {moreCount === 1 ? "lesson" : "lessons"}
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 text-le-text-hint transition-transform group-open/details:rotate-180" aria-hidden />
                              </summary>
                              <div className="border-t border-le-border/60 px-2 pb-2 pt-1">
                                <ul className="max-h-[min(320px,50vh)] space-y-0.5 overflow-y-auto overscroll-contain py-1">
                                  {ul.slice(1).map((lesson, idx) => {
                                    const lessonIdx = idx + 1;
                                    const rowKey = lessonCacheKey(subject, unit, lesson.id);
                                    const isOpening = openingKey === rowKey;
                                    return (
                                      <li key={lesson.id}>
                                        <button
                                          type="button"
                                          disabled={!!openingKey}
                                          onClick={() => openLesson(subject, unit, lessonIdx)}
                                          className={cn(
                                            "group/row flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                                            "hover:bg-le-hover/80",
                                            isOpening && "bg-le-accent/10 ring-1 ring-le-accent/30",
                                            openingKey && !isOpening && "pointer-events-none opacity-50"
                                          )}
                                        >
                                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-le-elevated text-xs font-semibold tabular-nums text-le-text-secondary">
                                            {lessonIdx + 1}
                                          </span>
                                          <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium text-le-text">
                                              {lesson.title}
                                            </span>
                                            <span className="mt-0.5 flex items-center gap-1 text-xs text-le-text-hint">
                                              <Clock className="h-3 w-3" />
                                              {lesson.duration}
                                            </span>
                                          </span>
                                          {isOpening ? (
                                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-le-accent" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 shrink-0 text-le-text-hint opacity-0 transition-opacity group-hover/row:opacity-100" />
                                          )}
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </details>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
