"use client";

import { useMemo } from "react";
import { BookOpen, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppMode, CurriculumIndex, CurriculumSubject } from "@/types";
import { getSubjectIcon } from "@/lib/subjectIcons";
import { BrandLogo } from "@/components/BrandLogo";

function SubjectIcon({ subject }: { subject: CurriculumSubject }) {
  const Icon = getSubjectIcon(subject.id);
  return <Icon className="h-4 w-4 flex-shrink-0" />;
}

interface SidebarProps {
  curriculum: CurriculumIndex | null;
  appMode: AppMode;
  selectedSubject: string | null;
  onModeChange: (mode: AppMode) => void;
  onLearnHome: () => void;
  onSubjectChange: (subject: string) => void;
}

export function Sidebar({
  curriculum,
  appMode,
  selectedSubject,
  onModeChange,
  onLearnHome,
  onSubjectChange,
}: SidebarProps) {
  const { standardSubjects, apSubjects, collegeSubjects } = useMemo(() => {
    if (!curriculum?.subjects?.length) {
      return {
        standardSubjects: [] as CurriculumSubject[],
        apSubjects: [] as CurriculumSubject[],
        collegeSubjects: [] as CurriculumSubject[],
      };
    }
    const standard: CurriculumSubject[] = [];
    const ap: CurriculumSubject[] = [];
    const college: CurriculumSubject[] = [];
    for (const s of curriculum.subjects) {
      if (s.track === "ap") ap.push(s);
      else if (s.track === "college-prep") college.push(s);
      else standard.push(s);
    }
    return {
      standardSubjects: standard,
      apSubjects: ap,
      collegeSubjects: college,
    };
  }, [curriculum]);

  return (
    <aside className="relative flex h-dvh w-[220px] flex-shrink-0 flex-col border-r border-le-border bg-le-surface/95 backdrop-blur-sm before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-gradient-to-b before:from-le-mint/25 before:via-le-accent/20 before:to-le-violet/25">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <BrandLogo size={30} />
        <span className="heading bg-gradient-to-r from-le-mint via-le-accent to-le-violet bg-clip-text text-lg text-transparent">
          OffLearn
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        <button
          type="button"
          onClick={onLearnHome}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            appMode === "learn"
              ? "bg-le-accent-soft text-le-accent"
              : "text-le-text-secondary hover:bg-le-hover hover:text-le-text"
          )}
        >
          <BookOpen className="h-4 w-4" />
          Learn
        </button>
        <button
          type="button"
          onClick={() => onModeChange("testprep")}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            appMode === "testprep"
              ? "bg-le-accent-soft text-le-accent"
              : "text-le-text-secondary hover:bg-le-hover hover:text-le-text"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          Test Prep
        </button>
      </nav>

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {!curriculum && (
            <p className="px-3 text-xs text-le-text-hint">Loading courses…</p>
          )}

          {curriculum && standardSubjects.length > 0 && (
            <>
              <p className="label-badge mb-2 px-3 text-le-text-hint">
                Standard courses
              </p>
              <div className="flex flex-col gap-0.5">
                {standardSubjects.map((subj) => (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => onSubjectChange(subj.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selectedSubject === subj.id && appMode === "learn"
                        ? "bg-le-hover font-medium text-le-text"
                        : "text-le-text-secondary hover:bg-le-hover/50 hover:text-le-text"
                    )}
                  >
                    <SubjectIcon subject={subj} />
                    <span className="truncate">{subj.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {curriculum && apSubjects.length > 0 && (
            <>
              <div className="my-3 border-t border-le-border/80" />
              <p className="label-badge mb-2 px-3 text-le-text-hint">
                Advanced Placement
              </p>
              <div className="flex flex-col gap-0.5">
                {apSubjects.map((subj) => (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => onSubjectChange(subj.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selectedSubject === subj.id && appMode === "learn"
                        ? "bg-le-hover font-medium text-le-text"
                        : "text-le-text-secondary hover:bg-le-hover/50 hover:text-le-text"
                    )}
                  >
                    <SubjectIcon subject={subj} />
                    <span className="min-w-0 flex-1 truncate">{subj.title}</span>
                    <span className="flex-shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      AP
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {curriculum && collegeSubjects.length > 0 && (
            <>
              <div className="my-3 border-t border-le-border/80" />
              <p className="label-badge mb-2 px-3 text-le-text-hint">
                College prep
              </p>
              <div className="flex flex-col gap-0.5">
                {collegeSubjects.map((subj) => (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => onSubjectChange(subj.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selectedSubject === subj.id && appMode === "learn"
                        ? "bg-le-hover font-medium text-le-text"
                        : "text-le-text-secondary hover:bg-le-hover/50 hover:text-le-text"
                    )}
                  >
                    <SubjectIcon subject={subj} />
                    <span className="min-w-0 flex-1 truncate">{subj.title}</span>
                    <span className="flex-shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      CP
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mx-3 mb-4 flex flex-shrink-0 items-center gap-2 rounded-lg border border-le-border bg-le-bg px-3 py-2.5">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-le-green" />
        <span className="text-xs font-medium text-le-text-secondary">
          Studying offline
        </span>
      </div>
    </aside>
  );
}
