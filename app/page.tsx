"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { getTutorEngine, selectEngineKind } from "@/lib/inference/engine";
import { getMeta, setMeta, getAllProfiles } from "@/lib/db/indexeddb";
import { LoadingScreen } from "@/components/LoadingScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ProfilePicker } from "@/components/ProfilePicker";
import { Sidebar } from "@/components/layout/Sidebar";
import { TutorPanel } from "@/components/layout/TutorPanel";
import { LearnView } from "@/components/views/LearnView";
import { TestPrepView } from "@/components/views/TestPrepView";
import { DashboardView } from "@/components/views/DashboardView";
import type { AppMode, CurriculumIndex, Profile } from "@/types";
import { normalizeCurriculumIndex } from "@/lib/curriculum/normalizeCurriculumIndex";
import { waitUntilSwControlling } from "@/lib/offline/waitUntilSwControlling";
import { primeRemoteGemmaModelCacheIfNeeded } from "@/lib/offline/primeRemoteGemmaCache";

export default function Home() {
  const {
    modelStatus,
    modelProgress,
    setModelStatus,
    setModelProgress,
    setModelError,
    setModelEngine,
    hasVisited,
    setHasVisited,
    appMode,
    setAppMode,
    selectedSubject,
    setSelectedSubject,
    activeProfileId,
    setActiveProfileId,
    progressVersion,
  } = useAppStore();

  const modelInitStarted = useRef(false);
  const [initChecked, setInitChecked] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [curriculum, setCurriculum] = useState<CurriculumIndex | null>(null);
  const [learnHomeNonce, setLearnHomeNonce] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [resumeTarget, setResumeTarget] = useState<{
    subjectId: string;
    unitId: string;
    lessonId: string;
  } | null>(null);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? null;

  const loadProfiles = useCallback(async () => {
    const list = await getAllProfiles();
    setProfiles(list);
    // If the active profile was deleted, drop it so the picker re-appears.
    const currentId = useAppStore.getState().activeProfileId;
    if (currentId && !list.some((p) => p.id === currentId)) {
      setActiveProfileId(null);
      void setMeta("activeProfileId", "");
    }
    return list;
  }, [setActiveProfileId]);

  const handleSelectProfile = useCallback(
    (id: string) => {
      setActiveProfileId(id);
      void setMeta("activeProfileId", id);
      setShowProfilePicker(false);
      setAppMode("dashboard");
      setSelectedSubject(null);
    },
    [setActiveProfileId, setAppMode, setSelectedSubject]
  );

  // Re-read profiles from IndexedDB whenever progress changes (a lesson opened
  // or marked complete) so the active profile's streak + last-lesson stay fresh.
  useEffect(() => {
    if (progressVersion === 0) return;
    void loadProfiles();
  }, [progressVersion, loadProfiles]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [visited, storedProfileId, profileList, res] = await Promise.all([
          getMeta("hasVisited"),
          getMeta("activeProfileId"),
          getAllProfiles(),
          fetch("/curriculum/index.json"),
        ]);
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(`Curriculum index failed (${res.status})`);
        }
        const raw = await res.json();
        const curriculumData = normalizeCurriculumIndex(raw);
        if (!curriculumData?.subjects?.length) {
          throw new Error("Invalid or empty curriculum index");
        }
        setCurriculum(curriculumData);

        setProfiles(profileList);
        if (storedProfileId && profileList.some((p) => p.id === storedProfileId)) {
          setActiveProfileId(storedProfileId);
        }

        if (!visited) {
          setShowWelcome(true);
        } else {
          setHasVisited(true);
        }
      } catch (err) {
        console.error("Init failed:", err);
      } finally {
        if (!cancelled) setInitChecked(true);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [setHasVisited, setActiveProfileId]);

  useEffect(() => {
    if (!curriculum?.subjects?.length) return;
    if (
      selectedSubject &&
      !curriculum.subjects.some((s) => s.id === selectedSubject)
    ) {
      setSelectedSubject(null);
    }
  }, [curriculum, selectedSubject, setSelectedSubject]);

  /** Warm test prep + knowledge JSON so Test Prep and RAG work offline without visiting those screens first. */
  useEffect(() => {
    if (!curriculum?.subjects?.length) return;
    const win = typeof window !== "undefined" ? window : null;
    if (!win) return;
    let cancelled = false;
    const urls = [
      "/testprep/sat-math.json",
      "/testprep/sat-reading.json",
      "/testprep/act-math.json",
      "/knowledge-packs/biology-krebs.json",
      "/knowledge-packs/physics-newton.json",
    ];
    const run = () => {
      if (cancelled) return;
      void Promise.allSettled(urls.map((u) => fetch(u)));
    };
    let idleHandle: number;
    if ("requestIdleCallback" in win) {
      idleHandle = win.requestIdleCallback(run, { timeout: 45_000 });
    } else {
      idleHandle = setTimeout(run, 500) as unknown as number;
    }
    return () => {
      cancelled = true;
      if ("cancelIdleCallback" in win) {
        win.cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }
    };
  }, [curriculum]);

  useEffect(() => {
    if (modelInitStarted.current) return;

    // Select GPU or CPU engine. This never hard-fails — CPU is the fallback
    // for any device without WebGPU (no more "unsupported browser" dead-end).
    const engineKind = selectEngineKind();
    setModelEngine(engineKind);

    modelInitStarted.current = true;
    setModelStatus("loading");
    setModelProgress(10);

    const progressInterval = setInterval(() => {
      const current = useAppStore.getState().modelProgress;
      if (current < 90) {
        setModelProgress(current + 5);
      }
    }, 2000);

    let cancelled = false;

    void (async () => {
      if (
        process.env.NODE_ENV === "production" &&
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator
      ) {
        try {
          await navigator.serviceWorker.ready;
          await waitUntilSwControlling(12000);
        } catch {
          /* continue — model may still load; SW cache less reliable */
        }
      }

      if (cancelled) {
        clearInterval(progressInterval);
        return;
      }

      // Gemma cache-priming is specific to the GPU path (.task file + SW).
      // The CPU model is fetched directly from HuggingFace by Transformers.js
      // and cached in its own Cache Storage — no priming needed.
      if (engineKind === "gpu") {
        try {
          await primeRemoteGemmaModelCacheIfNeeded();
        } catch (e) {
          console.warn("[OffLearn] Gemma cache prime skipped:", e);
        }
      }

      if (cancelled) {
        clearInterval(progressInterval);
        return;
      }

      getTutorEngine((pct) => {
        setModelProgress(pct);
      })
        .then(() => {
          if (cancelled) return;
          setModelStatus("ready");
          setModelProgress(100);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Model init failed:", err);
          setModelStatus("error");
          setModelError(
            err instanceof Error ? err.message : "Failed to set up lesson help"
          );
        })
        .finally(() => {
          clearInterval(progressInterval);
        });
    })();

    return () => {
      cancelled = true;
      clearInterval(progressInterval);
      modelInitStarted.current = false;
    };
  }, [setModelStatus, setModelProgress, setModelError, setModelEngine]);

  const handleWelcomeDismiss = async () => {
    setShowWelcome(false);
    setHasVisited(true);
    await setMeta("hasVisited", "true");
  };

  const handleModeChange = useCallback(
    (mode: AppMode) => {
      setAppMode(mode);
    },
    [setAppMode]
  );

  const goLearnHome = useCallback(() => {
    setAppMode("learn");
    setSelectedSubject(null);
    setLearnHomeNonce((n) => n + 1);
  }, [setAppMode, setSelectedSubject]);

  const goDashboard = useCallback(() => {
    setAppMode("dashboard");
  }, [setAppMode]);

  const openSubjectFromDashboard = useCallback(
    (subjectId: string) => {
      setResumeTarget(null);
      setSelectedSubject(subjectId);
      setAppMode("learn");
      setLearnHomeNonce((n) => n + 1);
    },
    [setAppMode, setSelectedSubject]
  );

  const resumeLesson = useCallback(
    (target: { subjectId: string; unitId: string; lessonId: string }) => {
      setSelectedSubject(target.subjectId);
      setResumeTarget(target);
      setAppMode("learn");
      setLearnHomeNonce((n) => n + 1);
    },
    [setAppMode, setSelectedSubject]
  );

  if (!initChecked) {
    return <div className="h-dvh bg-le-bg" />;
  }

  const showLoading = modelStatus === "loading" && !showWelcome;
  // Gate the app behind profile selection once the welcome screen is past.
  const needsProfile = !showWelcome && !activeProfile;
  const profilePickerVisible = needsProfile || showProfilePicker;

  const renderMainContent = () => {
    if (appMode === "dashboard" && activeProfile) {
      return (
        <DashboardView
          curriculum={curriculum}
          profile={activeProfile}
          onOpenSubject={openSubjectFromDashboard}
          onResume={resumeLesson}
        />
      );
    }
    if (appMode === "learn" && curriculum) {
      return (
        <LearnView
          key={learnHomeNonce}
          curriculum={curriculum}
          selectedSubject={selectedSubject}
          resumeTarget={resumeTarget}
          onResumeConsumed={() => setResumeTarget(null)}
        />
      );
    }
    if (appMode === "learn" && !curriculum) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-16 text-center">
          <p className="text-sm font-medium text-le-text">Could not load courses</p>
          <p className="text-xs text-le-text-secondary">
            Check your connection and refresh the page.
          </p>
        </div>
      );
    }
    if (appMode === "testprep") {
      return <TestPrepView />;
    }
    return null;
  };

  return (
    <>
      {showWelcome && <WelcomeScreen onStart={handleWelcomeDismiss} />}
      {profilePickerVisible && (
        <ProfilePicker
          profiles={profiles}
          onSelect={handleSelectProfile}
          onProfilesChanged={() => void loadProfiles()}
          dismissable={!!activeProfile}
          onClose={() => setShowProfilePicker(false)}
        />
      )}
      <LoadingScreen progress={modelProgress} visible={showLoading} />

      <div className="le-app-shell flex h-dvh">
        <Sidebar
          curriculum={curriculum}
          appMode={appMode}
          selectedSubject={selectedSubject}
          activeProfile={activeProfile}
          onModeChange={handleModeChange}
          onLearnHome={goLearnHome}
          onSubjectChange={(subject: string) => {
            setSelectedSubject(subject);
            if (appMode !== "learn") {
              handleModeChange("learn");
            }
          }}
          onDashboard={goDashboard}
          onSwitchProfile={() => setShowProfilePicker(true)}
        />

        <main className="main-scroll-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto [overflow-anchor:none]">
          {renderMainContent()}
        </main>

        <TutorPanel />
      </div>
    </>
  );
}
