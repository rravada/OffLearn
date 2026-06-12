"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, CheckCircle2, BookOpen, ArrowRight, Play } from "lucide-react";
import type {
  CurriculumIndex,
  CurriculumSubject,
  Profile,
  ProgressEntry,
} from "@/types";
import { getProgressForProfile, computeStreak } from "@/lib/db/indexeddb";
import { useAppStore } from "@/lib/store/useAppStore";
import { getSubjectIcon } from "@/lib/subjectIcons";

interface DashboardViewProps {
  curriculum: CurriculumIndex | null;
  profile: Profile;
  onOpenSubject: (subjectId: string) => void;
  onResume: (target: {
    subjectId: string;
    unitId: string;
    lessonId: string;
  }) => void;
}

function isAssessmentId(id: string) {
  return id === "unit-review" || id === "course-final";
}

function countableLessons(subject: CurriculumSubject): string[] {
  const keys: string[] = [];
  for (const unit of subject.units ?? []) {
    for (const lesson of unit.lessons ?? []) {
      if (isAssessmentId(lesson.id)) continue;
      keys.push(`${subject.id}/${unit.id}/${lesson.id}`);
    }
  }
  return keys;
}

/** Flat, in-order list of non-assessment lessons for a subject. */
function orderedLessons(
  subject: CurriculumSubject
): { unitId: string; lessonId: string; title: string }[] {
  const out: { unitId: string; lessonId: string; title: string }[] = [];
  for (const unit of subject.units ?? []) {
    for (const lesson of unit.lessons ?? []) {
      if (isAssessmentId(lesson.id)) continue;
      out.push({ unitId: unit.id, lessonId: lesson.id, title: lesson.title });
    }
  }
  return out;
}

export function DashboardView({
  curriculum,
  profile,
  onOpenSubject,
  onResume,
}: DashboardViewProps) {
  const progressVersion = useAppStore((s) => s.progressVersion);
  const [entries, setEntries] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await getProgressForProfile(profile.id);
      if (cancelled) return;
      setEntries(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.id, progressVersion]);

  const subjects = useMemo(
    () => (Array.isArray(curriculum?.subjects) ? curriculum!.subjects : []),
    [curriculum]
  );

  const completed = useMemo(
    () =>
      new Set(
        entries.map((e) => `${e.subjectId}/${e.unitId}/${e.lessonId}`)
      ),
    [entries]
  );

  // Resume = the lesson *after* the most recently completed one (so the student
  // keeps moving forward). Falls back to the last completed lesson if it was the
  // final one, then to the last lesson they simply opened.
  const resume = useMemo(() => {
    let recent: ProgressEntry | null = null;
    for (const e of entries) {
      if (!recent || e.completedAt > recent.completedAt) recent = e;
    }
    if (recent) {
      const subject = subjects.find((s) => s.id === recent!.subjectId);
      if (subject) {
        const ordered = orderedLessons(subject);
        const idx = ordered.findIndex(
          (l) => l.unitId === recent!.unitId && l.lessonId === recent!.lessonId
        );
        if (idx >= 0) {
          const next = ordered[idx + 1];
          const chosen = next ?? ordered[idx];
          return {
            subjectId: subject.id,
            unitId: chosen.unitId,
            lessonId: chosen.lessonId,
            title: chosen.title,
            label: next ? "Up next" : "Review your last lesson",
          };
        }
      }
    }
    if (profile.lastLesson) {
      return {
        subjectId: profile.lastLesson.subjectId,
        unitId: profile.lastLesson.unitId,
        lessonId: profile.lastLesson.lessonId,
        title: profile.lastLesson.title,
        label: "Continue where you left off",
      };
    }
    return null;
  }, [entries, subjects, profile.lastLesson]);

  const { totalDone, totalLessons, perSubject } = useMemo(() => {
    let done = 0;
    let total = 0;
    const rows = subjects.map((s) => {
      const keys = countableLessons(s);
      const sDone = keys.filter((k) => completed.has(k)).length;
      done += sDone;
      total += keys.length;
      return {
        subject: s,
        done: sDone,
        total: keys.length,
        pct: keys.length ? Math.round((sDone / keys.length) * 100) : 0,
      };
    });
    return { totalDone: done, totalLessons: total, perSubject: rows };
  }, [subjects, completed]);

  const streak = computeStreak(profile.activeDays);
  const started = perSubject
    .filter((r) => r.done > 0)
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="w-full px-8 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold text-le-bg"
            style={{ backgroundColor: profile.color }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="heading text-2xl text-le-text">
              Welcome back, {profile.name}
            </h1>
            <p className="text-sm text-le-text-secondary">
              Your progress lives on this device. No account needed.
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-le-border bg-le-surface p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500/15">
              <Flame className="h-5 w-5 text-orange-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-le-text">{streak}</p>
              <p className="text-xs text-le-text-secondary">
                day{streak === 1 ? "" : "s"} streak
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-le-border bg-le-surface p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-le-accent-soft">
              <CheckCircle2 className="h-5 w-5 text-le-accent" />
            </span>
            <div>
              <p className="text-2xl font-bold text-le-text">{totalDone}</p>
              <p className="text-xs text-le-text-secondary">lessons completed</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-le-border bg-le-surface p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-le-mint/15">
              <BookOpen className="h-5 w-5 text-le-mint" />
            </span>
            <div>
              <p className="text-2xl font-bold text-le-text">
                {totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0}
                <span className="text-base">%</span>
              </p>
              <p className="text-xs text-le-text-secondary">overall complete</p>
            </div>
          </div>
        </div>

        {/* Resume */}
        {resume && (
          <button
            type="button"
            onClick={() =>
              onResume({
                subjectId: resume.subjectId,
                unitId: resume.unitId,
                lessonId: resume.lessonId,
              })
            }
            className="mt-6 flex w-full items-center gap-4 rounded-xl border border-le-accent/30 bg-le-accent-soft/60 px-5 py-4 text-left transition-all hover:border-le-accent/50 hover:bg-le-accent-soft"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-le-accent text-le-bg">
              <Play className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-le-accent">
                {resume.label}
              </p>
              <p className="truncate text-sm font-medium text-le-text">
                {resume.title}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-le-accent" />
          </button>
        )}

        {/* Per-subject progress */}
        <h2 className="heading mb-3 mt-8 text-lg text-le-text">
          {started.length > 0 ? "Your courses" : "Start a course"}
        </h2>
        <div className="space-y-2.5">
          {perSubject.map(({ subject, done, total, pct }) => {
            const Glyph = getSubjectIcon(subject.id);
            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => onOpenSubject(subject.id)}
                className="group flex w-full items-center gap-4 rounded-xl border border-le-border bg-le-surface/80 px-5 py-4 text-left transition-all hover:border-le-mint/35 hover:bg-le-elevated"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-le-accent-soft">
                  <Glyph className="h-5 w-5 text-le-accent" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-le-text group-hover:text-le-accent">
                      {subject.title}
                    </p>
                    <p className="flex-shrink-0 text-xs tabular-nums text-le-text-secondary">
                      {done}/{total}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-le-elevated">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-le-mint/90 to-le-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-le-text-hint group-hover:text-le-accent" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
