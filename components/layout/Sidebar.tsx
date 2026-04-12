"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppMode } from "@/types";

const SUBJECT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  math: Calculator,
  science: FlaskConical,
  history: Landmark,
  english: PenLine,
  economics: TrendingUp,
  cs: Code2,
};

const SUBJECTS = [
  { id: "math", label: "Math" },
  { id: "science", label: "Science" },
  { id: "history", label: "History" },
  { id: "english", label: "English" },
  { id: "economics", label: "Economics" },
  { id: "cs", label: "CS" },
];

interface SidebarProps {
  appMode: AppMode;
  selectedSubject: string | null;
  onModeChange: (mode: AppMode) => void;
  onSubjectChange: (subject: string) => void;
}

export function Sidebar({
  appMode,
  selectedSubject,
  onModeChange,
  onSubjectChange,
}: SidebarProps) {
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

      {/* Subject List */}
      <div className="mt-6 flex flex-col gap-1 px-3">
        <p className="label-badge mb-2 px-3 text-le-text-hint">Subjects</p>
        {SUBJECTS.map((subj) => {
          const Icon = SUBJECT_ICONS[subj.id];
          return (
            <button
              key={subj.id}
              type="button"
              onClick={() => onSubjectChange(subj.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                selectedSubject === subj.id
                  ? "bg-le-hover text-le-text font-medium"
                  : "text-le-text-secondary hover:bg-le-hover/50 hover:text-le-text"
              )}
            >
              <Icon className="h-4 w-4" />
              {subj.label}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Offline Badge */}
      <div className="mx-3 mb-4 flex items-center gap-2 rounded-lg border border-le-border bg-le-bg px-3 py-2.5">
        <span className="h-2 w-2 rounded-full bg-le-green animate-pulse-dot" />
        <span className="text-xs font-medium text-le-text-secondary">
          Studying offline
        </span>
      </div>
    </aside>
  );
}
