"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ClipboardList,
  Download,
  X,
  LayoutDashboard,
  ChevronsUpDown,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppMode, CurriculumIndex, CurriculumSubject, Profile } from "@/types";
import { getSubjectIcon } from "@/lib/subjectIcons";
import { getSubjectColor } from "@/lib/subjectColors";
import { BrandLogo } from "@/components/BrandLogo";
import { useAppStore } from "@/lib/store/useAppStore";

interface SidebarProps {
  curriculum: CurriculumIndex | null;
  appMode: AppMode;
  selectedSubject: string | null;
  activeProfile: Profile | null;
  onModeChange: (mode: AppMode) => void;
  onLearnHome: () => void;
  onSubjectChange: (subject: string) => void;
  onDashboard: () => void;
  onSwitchProfile: () => void;
}

const NAV_ITEMS = [
  { id: "dashboard" as const, label: "My Progress", Icon: LayoutDashboard },
  { id: "learn" as const, label: "Learn", Icon: BookOpen },
  { id: "testprep" as const, label: "Test Prep", Icon: ClipboardList },
];

function SubjectRow({
  subject,
  isActive,
  trackBadge,
  trackColor,
  onClick,
}: {
  subject: CurriculumSubject;
  isActive: boolean;
  trackBadge?: string;
  trackColor?: string;
  onClick: () => void;
}) {
  const Icon = getSubjectIcon(subject.id);
  const color = getSubjectColor(subject.id);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        isActive
          ? "bg-le-elevated font-medium text-le-text"
          : "text-le-text-secondary hover:bg-le-hover/70 hover:text-le-text"
      )}
    >
      {isActive && (
        <span
          className="absolute left-0 inset-y-[6px] w-[3px] rounded-r-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className="h-[7px] w-[7px] flex-shrink-0 rounded-full transition-opacity"
        style={{ backgroundColor: color, opacity: isActive ? 1 : 0.65 }}
      />
      <Icon className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
      <span className="min-w-0 flex-1 truncate">{subject.title}</span>
      {trackBadge && trackColor && (
        <span
          className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: `${trackColor}22`,
            color: trackColor,
          }}
        >
          {trackBadge}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  curriculum,
  appMode,
  selectedSubject,
  activeProfile,
  onModeChange,
  onLearnHome,
  onSubjectChange,
  onDashboard,
  onSwitchProfile,
}: SidebarProps) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const { standardSubjects, apSubjects, collegeSubjects } = useMemo(() => {
    const empty = {
      standardSubjects: [] as CurriculumSubject[],
      apSubjects: [] as CurriculumSubject[],
      collegeSubjects: [] as CurriculumSubject[],
    };
    const list = curriculum?.subjects;
    if (!Array.isArray(list) || list.length === 0) return empty;
    const standard: CurriculumSubject[] = [];
    const ap: CurriculumSubject[] = [];
    const college: CurriculumSubject[] = [];
    for (const s of list) {
      if (!s || typeof s !== "object" || typeof s.id !== "string") continue;
      if (s.track === "ap") ap.push(s);
      else if (s.track === "college-prep") college.push(s);
      else standard.push(s);
    }
    return { standardSubjects: standard, apSubjects: ap, collegeSubjects: college };
  }, [curriculum]);

  const handleNavClick = (id: string) => {
    if (id === "dashboard") onDashboard();
    else if (id === "learn") onLearnHome();
    else if (id === "testprep") onModeChange("testprep");
  };

  const isNavActive = (id: string) => {
    if (id === "learn") return appMode === "learn";
    if (id === "testprep") return appMode === "testprep";
    if (id === "dashboard") return appMode === "dashboard";
    return false;
  };

  return (
    <aside className="flex h-dvh w-[240px] flex-shrink-0 flex-col border-r border-le-border bg-le-surface">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <BrandLogo size={30} />
        <span className="font-display font-bold text-lg text-le-accent">
          OffLearn
        </span>
      </div>

      {/* Profile chip */}
      {activeProfile && (
        <button
          type="button"
          onClick={onSwitchProfile}
          title="Switch profile"
          className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl border border-le-border bg-le-elevated px-3 py-2.5 text-left transition-colors hover:bg-le-hover"
        >
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ backgroundColor: activeProfile.color, color: "#0F0E0C" }}
          >
            {activeProfile.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-le-text">
            {activeProfile.name}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-le-text-hint" />
        </button>
      )}

      {/* Primary navigation */}
      <nav className="flex flex-col gap-0.5 px-2 mb-3">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = isNavActive(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleNavClick(id)}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-le-accent/10 text-le-accent"
                  : "text-le-text-secondary hover:bg-le-hover hover:text-le-text"
              )}
            >
              {active && (
                <span className="absolute left-0 inset-y-[7px] w-[3px] rounded-r-full bg-le-accent" />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mx-4 border-t border-le-border/60" />

      {/* Course navigation */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {!curriculum && (
            <p className="px-3 py-2 text-xs text-le-text-hint">Loading courses…</p>
          )}

          {standardSubjects.length > 0 && (
            <div className="mb-1">
              <p className="label-badge mb-1.5 flex items-center gap-1.5 px-3 text-le-text-hint">
                <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-le-mint" />
                Standard
              </p>
              {standardSubjects.map((subj) => (
                <SubjectRow
                  key={subj.id}
                  subject={subj}
                  isActive={selectedSubject === subj.id && appMode === "learn"}
                  onClick={() => onSubjectChange(subj.id)}
                />
              ))}
            </div>
          )}

          {apSubjects.length > 0 && (
            <>
              <div className="my-2.5 border-t border-le-border/50" />
              <div className="mb-1">
                <p className="label-badge mb-1.5 flex items-center gap-1.5 px-3 text-le-text-hint">
                  <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-le-violet" />
                  Advanced Placement
                </p>
                {apSubjects.map((subj) => (
                  <SubjectRow
                    key={subj.id}
                    subject={subj}
                    isActive={selectedSubject === subj.id && appMode === "learn"}
                    trackBadge="AP"
                    trackColor="#9158F3"
                    onClick={() => onSubjectChange(subj.id)}
                  />
                ))}
              </div>
            </>
          )}

          {collegeSubjects.length > 0 && (
            <>
              <div className="my-2.5 border-t border-le-border/50" />
              <div className="mb-1">
                <p className="label-badge mb-1.5 flex items-center gap-1.5 px-3 text-le-text-hint">
                  <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-le-accent" />
                  College prep
                </p>
                {collegeSubjects.map((subj) => (
                  <SubjectRow
                    key={subj.id}
                    subject={subj}
                    isActive={selectedSubject === subj.id && appMode === "learn"}
                    trackBadge="CP"
                    trackColor="#60A5FA"
                    onClick={() => onSubjectChange(subj.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 space-y-1 border-t border-le-border/40">
        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
        >
          <Download className="h-3.5 w-3.5 flex-shrink-0" />
          Export for offline
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <Moon className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="h-[7px] w-[7px] animate-pulse-dot rounded-full bg-le-green flex-shrink-0" />
          <span className="text-xs text-le-text-hint">Studying offline</span>
        </div>
      </div>

      {mounted &&
        showExportModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowExportModal(false)}
          >
            <div
              className="relative mx-4 w-full max-w-md rounded-2xl border border-le-border bg-le-surface p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-le-text-hint transition-colors hover:bg-le-hover hover:text-le-text"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-le-accent/10">
                  <Download className="h-5 w-5 text-le-accent" />
                </div>
                <h2 className="heading text-base text-le-text">Portable &amp; Offline-Ready</h2>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-le-text-secondary">
                OffLearn can be packaged into a single portable file — the full
                app plus the on-device AI tutor — ready to run completely offline.
              </p>
              <p className="mb-3 text-sm leading-relaxed text-le-text-secondary">
                Distribute via USB to schools with no internet. Unzip and
                double-click — zero setup required.
              </p>
              <p className="text-sm leading-relaxed text-le-text-secondary">
                Built for districts where reliable connectivity can&apos;t be assumed.
              </p>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="mt-5 w-full rounded-xl bg-le-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                Got it
              </button>
            </div>
          </div>,
          document.body
        )}
    </aside>
  );
}
