"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { LLMSession, checkWebGPUSupport } from "@/lib/inference/mediapipe";
import {
  getMeta,
  setMeta,
  getTeacherModules,
  deleteTeacherModule,
} from "@/lib/db/indexeddb";
import { LoadingScreen } from "@/components/LoadingScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { Sidebar } from "@/components/layout/Sidebar";
import { TutorPanel } from "@/components/layout/TutorPanel";
import { LearnView } from "@/components/views/LearnView";
import { TestPrepView } from "@/components/views/TestPrepView";
import { CreateModuleView } from "@/components/views/CreateModuleView";
import { ModuleStudyView } from "@/components/views/ModuleStudyView";
import type { CurriculumIndex, TeacherModule } from "@/types";

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

  const [teacherModules, setTeacherModules] = useState<TeacherModule[]>([]);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [showCreateModule, setShowCreateModule] = useState(false);
  const [moduleSendHandler, setModuleSendHandler] = useState<
    ((text: string) => Promise<void>) | null
  >(null);

  const refreshModules = useCallback(async () => {
    const modules = await getTeacherModules();
    setTeacherModules(modules.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [visited, curriculumData] = await Promise.all([
          getMeta("hasVisited"),
          fetch("/curriculum/index.json", { cache: "no-store" }).then(
            (r) => r.json() as Promise<CurriculumIndex>
          ),
        ]);
        if (cancelled) return;

        setCurriculum(curriculumData);

        if (!visited) {
          setShowWelcome(true);
        } else {
          setHasVisited(true);
        }

        await refreshModules();
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
  }, [setHasVisited, refreshModules]);

  useEffect(() => {
    if (!curriculum?.subjects?.length) return;
    if (
      selectedSubject &&
      !curriculum.subjects.some((s) => s.id === selectedSubject)
    ) {
      setSelectedSubject(null);
    }
  }, [curriculum, selectedSubject, setSelectedSubject]);

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
          err instanceof Error ? err.message : "Failed to load AI model"
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

  const handleOpenModule = useCallback(
    (id: string) => {
      setActiveModuleId(id);
      setShowCreateModule(false);
      setAppMode("module");
    },
    [setAppMode]
  );

  const handleCreateModule = useCallback(() => {
    setShowCreateModule(true);
    setActiveModuleId(null);
    setAppMode("module");
  }, [setAppMode]);

  const handleDeleteModule = useCallback(
    async (id: string) => {
      await deleteTeacherModule(id);
      await refreshModules();
      if (activeModuleId === id) {
        setActiveModuleId(null);
        setShowCreateModule(false);
        setAppMode("learn");
      }
    },
    [activeModuleId, refreshModules, setAppMode]
  );

  const handleModuleCreated = useCallback(
    async (module: TeacherModule) => {
      await refreshModules();
      setShowCreateModule(false);
      setActiveModuleId(module.id);
      setAppMode("module");
    },
    [refreshModules, setAppMode]
  );

  const handleModeChange = useCallback(
    (mode: "learn" | "testprep" | "module") => {
      setAppMode(mode);
      setShowCreateModule(false);
      if (mode !== "module") {
        setActiveModuleId(null);
      }
    },
    [setAppMode]
  );

  const handleBackFromModule = useCallback(() => {
    setShowCreateModule(false);
    setActiveModuleId(null);
    setModuleSendHandler(null);
    setAppMode("learn");
  }, [setAppMode]);

  if (!initChecked) {
    return <div className="h-dvh bg-le-bg" />;
  }

  const showLoading = modelStatus === "loading" && !showWelcome;

  const renderMainContent = () => {
    if (appMode === "module" && showCreateModule) {
      return (
        <CreateModuleView
          onBack={handleBackFromModule}
          onModuleCreated={handleModuleCreated}
        />
      );
    }
    if (appMode === "module" && activeModuleId) {
      return (
        <ModuleStudyView
          key={activeModuleId}
          moduleId={activeModuleId}
          onBack={handleBackFromModule}
          onSendHandlerReady={(handler) => setModuleSendHandler(() => handler)}
        />
      );
    }
    if (appMode === "learn" && curriculum) {
      return (
        <LearnView
          curriculum={curriculum}
          selectedSubject={selectedSubject}
        />
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

      <div className="flex h-dvh bg-le-bg">
        <Sidebar
          curriculum={curriculum}
          appMode={appMode}
          selectedSubject={selectedSubject}
          onModeChange={handleModeChange}
          onSubjectChange={(subject: string) => {
            setSelectedSubject(subject);
            if (appMode !== "learn") {
              handleModeChange("learn");
            }
          }}
          teacherModules={teacherModules}
          activeModuleId={activeModuleId}
          onOpenModule={handleOpenModule}
          onCreateModule={handleCreateModule}
          onDeleteModule={handleDeleteModule}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {renderMainContent()}
        </main>

        <TutorPanel
          onSendOverride={
            appMode === "module" && moduleSendHandler
              ? moduleSendHandler
              : undefined
          }
        />
      </div>
    </>
  );
}
