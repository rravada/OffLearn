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
import { getSubjectColor, subjectColorAlpha } from "@/lib/subjectColors";

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
    return () => { cancelled = true; };
  }, [profile.id, progressVersion]);

  const subjects = useMemo(
    () => (Array.isArray(curriculum?.subjects) ? curriculum!.subjects : []),
    [curriculum]
  );

  const completed = useMemo(
    () => new Set(entries.map((e) => `${e.subjectId}/${e.unitId}/${e.lessonId}`)),
    [entries]
  );

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
            subjectTitle: subject.title,
            label: next ? "Up next" : "Review last lesson",
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
        subjectTitle: "",
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

  const STATS = [
    {
      icon: Flame,
      value: streak,
      label: `day${streak === 1 ? "" : "s"} streak`,
      color: "#F59E0B",
    },
    {
      icon: CheckCircle2,
      value: totalDone,
      label: "lessons done",
      color: "#4ADE80",
    },
    {
      icon: BookOpen,
      value: `${totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0}%`,
      label: "complete",
      color: "#0DCCAA",
    },
  ];

  return (
    <div className="w-full px-8 py-10">
      <div className="mx-auto max-w-4xl">

        {/* Profile header */}
        <div className="mb-8 flex items-center gap-4">
          <span
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold"
            style={{ backgroundColor: profile.color, color: "#0F0E0C" }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-le-text-hint">
              Welcome back
            </p>
            <h1 className="font-display font-bold text-2xl text-le-text" style={{ letterSpacing: "-0.025em" }}>
              {profile.name}
            </h1>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          {STATS.map(({ icon: Icon, value, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-le-border bg-le-surface px-5 py-4"
            >
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}1A` }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </span>
              <div>
                <p className="font-display font-bold text-2xl text-le-text leading-none">
                  {value}
                </p>
                <p className="mt-0.5 text-xs text-le-text-secondary">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Resume card */}
        {resume && (
          <button
            type="button"
            onClick={() => onResume({ subjectId: resume.subjectId, unitId: resume.unitId, lessonId: resume.lessonId })}
            className="mb-8 group flex w-full items-center gap-4 rounded-2xl border border-le-accent/25 bg-le-accent/8 px-5 py-4 text-left transition-all hover:border-le-accent/45 hover:bg-le-accent/12"
            style={{ backgroundColor: "rgb(var(--le-accent) / 0.06)" }}
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-le-accent">
              <Play className="h-5 w-5 fill-white text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-le-accent">
                {resume.label}
              </p>
              <p className="truncate text-sm font-medium text-le-text">{resume.title}</p>
              {resume.subjectTitle && (
                <p className="truncate text-xs text-le-text-secondary">{resume.subjectTitle}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-le-accent transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {/* Course grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-le-text" style={{ letterSpacing: "-0.02em" }}>
            {perSubject.some((r) => r.done > 0) ? "Your courses" : "Start a course"}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {perSubject.map(({ subject, done, total, pct }) => {
            const Glyph = getSubjectIcon(subject.id);
            const color = getSubjectColor(subject.id);
            const softBg = subjectColorAlpha(subject.id, 0.12);
            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => onOpenSubject(subject.id)}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-le-border bg-le-surface p-5 text-left transition-all duration-200 hover:border-le-border-strong hover:bg-le-elevated hover:shadow-card-hover cursor-pointer"
              >
                {/* Top color bar */}
                <div
                  className="absolute left-0 right-0 top-0 h-[3px] rounded-t-2xl"
                  style={{ backgroundColor: color }}
                />

                {/* Icon */}
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: softBg }}
                >
                  <Glyph className="h-5 w-5" style={{ color }} />
                </div>

                {/* Subject info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-le-text truncate">
                    {subject.title}
                  </p>
                  <p className="mt-0.5 text-xs text-le-text-secondary">
                    {done > 0 ? `${done} of ${total} lessons` : `${total} lessons`}
                  </p>
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="w-full h-1 rounded-full bg-le-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, pct > 0 ? 4 : 0)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                )}

                {pct === 100 && (
                  <span
                    className="absolute right-4 top-5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
