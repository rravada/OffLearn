"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { LLMSession, checkWebGPUSupport } from "@/lib/inference/mediapipe";
import { getMeta, setMeta } from "@/lib/db/indexeddb";
import { LoadingScreen } from "@/components/LoadingScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { Sidebar } from "@/components/layout/Sidebar";
import { TutorPanel } from "@/components/layout/TutorPanel";
import { LearnView } from "@/components/views/LearnView";
import { TestPrepView } from "@/components/views/TestPrepView";
import type { CurriculumIndex } from "@/types";
import { normalizeCurriculumIndex } from "@/lib/curriculum/normalizeCurriculumIndex";

export default function Home() {
  const {
    modelStatus,
    modelProgress,
    setModelStatus,
    setModelProgress,
    setModelError,
    hasVisited,
    setHasVisited,
    appMode,
    setAppMode,
    selectedSubject,
    setSelectedSubject,
  } = useAppStore();

  const modelInitStarted = useRef(false);
  const [initChecked, setInitChecked] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [curriculum, setCurriculum] = useState<CurriculumIndex | null>(null);
  const [learnHomeNonce, setLearnHomeNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [visited, res] = await Promise.all([
          getMeta("hasVisited"),
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
  }, [setHasVisited]);

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
    if (!checkWebGPUSupport()) {
      setModelStatus("error");
      setModelError(
        "Your browser does not support WebGPU. Try Chrome 113+ on desktop."
      );
      return;
    }

    modelInitStarted.current = true;
    setModelStatus("loading");
    setModelProgress(10);

    const progressInterval = setInterval(() => {
      const current = useAppStore.getState().modelProgress;
      if (current < 90) {
        setModelProgress(current + 5);
      }
    }, 2000);

    LLMSession.getInstance((pct) => {
      setModelProgress(pct);
    })
      .then(() => {
        setModelStatus("ready");
        setModelProgress(100);
      })
      .catch((err) => {
        console.error("Model init failed:", err);
        setModelStatus("error");
        setModelError(
          err instanceof Error ? err.message : "Failed to set up the tutor"
        );
      })
      .finally(() => {
        clearInterval(progressInterval);
      });
  }, [setModelStatus, setModelProgress, setModelError]);

  const handleWelcomeDismiss = async () => {
    setShowWelcome(false);
    setHasVisited(true);
    await setMeta("hasVisited", "true");
  };

  const handleModeChange = useCallback(
    (mode: "learn" | "testprep") => {
      setAppMode(mode);
    },
    [setAppMode]
  );

  const goLearnHome = useCallback(() => {
    setAppMode("learn");
    setSelectedSubject(null);
    setLearnHomeNonce((n) => n + 1);
  }, [setAppMode, setSelectedSubject]);

  if (!initChecked) {
    return <div className="h-dvh bg-le-bg" />;
  }

  const showLoading = modelStatus === "loading" && !showWelcome;

  const renderMainContent = () => {
    if (appMode === "learn" && curriculum) {
      return (
        <LearnView
          key={learnHomeNonce}
          curriculum={curriculum}
          selectedSubject={selectedSubject}
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
      <LoadingScreen progress={modelProgress} visible={showLoading} />

      <div className="le-app-shell flex h-dvh">
        <Sidebar
          curriculum={curriculum}
          appMode={appMode}
          selectedSubject={selectedSubject}
          onModeChange={handleModeChange}
          onLearnHome={goLearnHome}
          onSubjectChange={(subject: string) => {
            setSelectedSubject(subject);
            if (appMode !== "learn") {
              handleModeChange("learn");
            }
          }}
        />

        <main className="main-scroll-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto [overflow-anchor:none]">
          {renderMainContent()}
        </main>

        <TutorPanel />
      </div>
    </>
  );
}
