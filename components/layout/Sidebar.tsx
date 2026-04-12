"use client";

import { useState, useMemo } from "react";
import {
  Zap,
  BookOpen,
  ClipboardList,
  Calculator,
  FlaskConical,
  Landmark,
  PenLine,
  TrendingUp,
  Code2,
  Plus,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  Globe,
  Leaf,
  Brain,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppMode, TeacherModule, CurriculumIndex, CurriculumSubject } from "@/types";

const ICON_BY_SLUG: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  calculator: Calculator,
  flask: FlaskConical,
  landmark: Landmark,
  pen: PenLine,
  "trending-up": TrendingUp,
  code: Code2,
  zap: Zap,
  globe: Globe,
  leaf: Leaf,
  brain: Brain,
  "graduation-cap": GraduationCap,
};

function SubjectIcon({ subject }: { subject: CurriculumSubject }) {
  const Icon = ICON_BY_SLUG[subject.icon] ?? BookOpen;
  return <Icon className="h-4 w-4 flex-shrink-0" />;
}

interface SidebarProps {
  curriculum: CurriculumIndex | null;
  appMode: AppMode;
  selectedSubject: string | null;
  onModeChange: (mode: AppMode) => void;
  onSubjectChange: (subject: string) => void;
  teacherModules: TeacherModule[];
  activeModuleId: string | null;
  onOpenModule: (id: string) => void;
  onCreateModule: () => void;
  onDeleteModule: (id: string) => void;
}

export function Sidebar({
  curriculum,
  appMode,
  selectedSubject,
  onModeChange,
  onSubjectChange,
  teacherModules = [],
  activeModuleId = null,
  onOpenModule,
  onCreateModule,
  onDeleteModule,
}: SidebarProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedApId, setExpandedApId] = useState<string | null>(null);

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
    <aside className="flex h-dvh w-[220px] flex-shrink-0 flex-col border-r border-le-border bg-le-surface">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Zap className="h-6 w-6 text-le-accent" />
        <span className="heading text-lg text-le-accent">OffLearn</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3">
        <button
          type="button"
          onClick={() => onModeChange("learn")}
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

      {/* Curriculum + teacher modules — scrolls; index.json is the only source of courses */}
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
              {apSubjects.map((subj) => {
                const expanded = expandedApId === subj.id;
                return (
                  <div key={subj.id} className="rounded-lg">
                    <div className="flex items-stretch gap-0.5">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedApId((id) =>
                            id === subj.id ? null : subj.id
                          )
                        }
                        className="flex w-8 flex-shrink-0 items-center justify-center rounded-lg text-le-text-hint hover:bg-le-hover hover:text-le-text"
                        title={expanded ? "Collapse units" : "Show units"}
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            expanded ? "rotate-0" : "-rotate-90"
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSubjectChange(subj.id)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pl-1 pr-2 text-left text-sm transition-colors",
                          selectedSubject === subj.id && appMode === "learn"
                            ? "bg-le-hover font-medium text-le-text"
                            : "text-le-text-secondary hover:bg-le-hover/50 hover:text-le-text"
                        )}
                      >
                        <SubjectIcon subject={subj} />
                        <span className="min-w-0 flex-1 truncate">
                          {subj.title}
                        </span>
                        <span className="flex-shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          AP
                        </span>
                      </button>
                    </div>
                    {expanded && (
                      <ul className="mb-1 ml-8 mt-0.5 space-y-1 border-l border-le-border/60 pl-2">
                        {subj.units.map((u) => (
                          <li
                            key={u.id}
                            className="text-[11px] leading-snug text-le-text-hint"
                          >
                            {u.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
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

      {/* My Modules */}
      <div className="mt-4 flex flex-col gap-1 border-t border-le-border/80 pt-4">
        <p className="label-badge mb-2 px-3 text-le-text-hint">My Modules</p>

        {teacherModules.length === 0 && (
          <p className="px-3 text-xs italic text-le-text-hint">
            No modules yet
          </p>
        )}

        {teacherModules.map((mod) => (
          <div key={mod.id} className="group relative">
            <button
              type="button"
              onClick={() => onOpenModule(mod.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                activeModuleId === mod.id && appMode === "module"
                  ? "bg-le-hover font-medium text-le-text"
                  : "text-le-text-secondary hover:bg-le-hover/50 hover:text-le-text"
              )}
            >
              <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{mod.title}</p>
                <span className="mt-0.5 inline-block rounded-full bg-le-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-le-accent">
                  {mod.subject}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(menuOpenId === mod.id ? null : mod.id);
                setConfirmDeleteId(null);
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-le-text-hint opacity-0 transition-opacity hover:bg-le-hover hover:text-le-text group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {menuOpenId === mod.id && (
              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-le-border bg-le-surface py-1 shadow-xl">
                {confirmDeleteId === mod.id ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteModule(mod.id);
                      setMenuOpenId(null);
                      setConfirmDeleteId(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-le-red hover:bg-le-hover"
                  >
                    <Trash2 className="h-3 w-3" />
                    Confirm delete?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(mod.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-le-text-secondary hover:bg-le-hover hover:text-le-text"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete module
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={onCreateModule}
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-le-accent transition-colors hover:bg-le-accent-soft"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Module
        </button>
      </div>
        </div>
      </div>

      {/* Offline Badge */}
      <div className="mx-3 mb-4 flex flex-shrink-0 items-center gap-2 rounded-lg border border-le-border bg-le-bg px-3 py-2.5">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-le-green" />
        <span className="text-xs font-medium text-le-text-secondary">
          Studying offline
        </span>
      </div>
    </aside>
  );
}
