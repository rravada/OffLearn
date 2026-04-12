"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Sparkles,
  BookOpen,
  FileText,
  ChevronRight,
  Key,
  MessageSquare,
} from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { getTeacherModule } from "@/lib/db/indexeddb";
import {
  buildIndex,
  searchModule,
  isModuleIndexed,
} from "@/lib/pdf/moduleSearch";
import { embedText } from "@/lib/pdf/embedChunks";
import { LLMSession } from "@/lib/inference/mediapipe";
import { cleanResponse, generateId } from "@/lib/utils";
import type { TeacherModule, Message } from "@/types";

interface ModuleStudyViewProps {
  moduleId: string;
  onBack: () => void;
  onSendHandlerReady: (
    handler: ((text: string) => Promise<void>) | null
  ) => void;
}

function buildSystemPrompt(moduleTitle: string, ragContext: string): string {
  const contextBlock = ragContext
    ? `\n\nRELEVANT CONTENT FROM MODULE:\n${ragContext}`
    : "";

  return `You are a Socratic tutor helping a student study teacher-provided course materials. The module is called: ${moduleTitle}.${contextBlock}

When the student asks a question:
1. Search the module content for relevant information
2. Use that information to guide them Socratically — never just recite it
3. Ask guiding questions that lead them to understand the concept
4. Confirm correct answers warmly
5. Redirect wrong answers with a new guiding question
6. If a question is clearly outside the module content, say: 'That does not appear to be covered in this module. Try asking your teacher or checking another source.'
7. Strip all model artifact tokens before responding.`;
}

function extractTopics(
  embeddings: { text: string }[],
  maxTopics = 8
): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];

  for (const chunk of embeddings) {
    const sentences = chunk.text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 120);

    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        topics.push(sentence);
        if (topics.length >= maxTopics) return topics;
      }
    }
  }

  return topics;
}

export function ModuleStudyView({
  moduleId,
  onBack,
  onSendHandlerReady,
}: ModuleStudyViewProps) {
  const {
    setTutorOpen,
    setTutorSystemPrompt,
    clearTutorMessages,
    addTutorMessage,
    setIsTutorGenerating,
    setTutorStreamingContent,
    appendTutorStreamingContent,
    isTutorGenerating,
    modelStatus,
  } = useAppStore();

  const [teacherModule, setTeacherModule] = useState<TeacherModule | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [indexReady, setIndexReady] = useState(false);

  const ragEnabledRef = useRef(false);

  const topics = useMemo(() => {
    if (!teacherModule) return [];
    return extractTopics(teacherModule.embeddings);
  }, [teacherModule]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const mod = await getTeacherModule(moduleId);
      if (cancelled || !mod) {
        setLoading(false);
        return;
      }
      setTeacherModule(mod);

      if (!isModuleIndexed(moduleId)) {
        await buildIndex(moduleId, mod.embeddings);
      }
      if (!cancelled) {
        setIndexReady(true);
        ragEnabledRef.current = true;
        setLoading(false);

        clearTutorMessages();
        setTutorSystemPrompt(buildSystemPrompt(mod.title, ""));
        setTutorOpen(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const openTutor = useCallback(() => {
    if (!teacherModule) return;
    setTutorSystemPrompt(buildSystemPrompt(teacherModule.title, ""));
    setTutorOpen(true);
  }, [teacherModule, setTutorSystemPrompt, setTutorOpen]);

  const handleModuleSend = useCallback(
    async (text: string) => {
      if (
        !text.trim() ||
        isTutorGenerating ||
        modelStatus !== "ready" ||
        !teacherModule
      )
        return;

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      addTutorMessage(userMsg);
      setIsTutorGenerating(true);
      setTutorStreamingContent("");

      try {
        let ragContext = "";
        if (ragEnabledRef.current && indexReady) {
          const queryEmbedding = await embedText(text);
          const relevantChunks = searchModule(moduleId, queryEmbedding, 3);
          ragContext = relevantChunks.join("\n\n");
        }

        const systemPrompt = buildSystemPrompt(
          teacherModule.title,
          ragContext
        );

        const conversationContext = useAppStore
          .getState()
          .tutorMessages.map(
            (m) =>
              `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`
          )
          .join("\n");

        const fullPrompt = `${conversationContext}\nStudent: ${text}`;

        const session = await LLMSession.getInstance();
        const result = await session.streamResponse(
          fullPrompt,
          (chunk) => {
            appendTutorStreamingContent(chunk);
          },
          systemPrompt
        );

        const cleaned = cleanResponse(result);
        const assistantMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: cleaned,
          timestamp: Date.now(),
        };
        addTutorMessage(assistantMsg);
      } catch (err) {
        console.error("Module tutor error:", err);
        const errorMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: "I had trouble generating a response. Please try again.",
          timestamp: Date.now(),
        };
        addTutorMessage(errorMsg);
      } finally {
        setIsTutorGenerating(false);
        setTutorStreamingContent("");
      }
    },
    [
      isTutorGenerating,
      modelStatus,
      teacherModule,
      indexReady,
      moduleId,
      addTutorMessage,
      setIsTutorGenerating,
      setTutorStreamingContent,
      appendTutorStreamingContent,
    ]
  );

  useEffect(() => {
    if (teacherModule && indexReady) {
      onSendHandlerReady(handleModuleSend);
    }
    return () => {
      onSendHandlerReady(null);
    };
  }, [teacherModule, indexReady, handleModuleSend, onSendHandlerReady]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-le-accent border-t-transparent" />
          <p className="text-sm text-le-text-secondary">
            Loading module and building search index...
          </p>
        </div>
      </div>
    );
  }

  if (!teacherModule) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-le-text-secondary">Module not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-le-accent hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header — matches lesson header */}
      <div className="border-b border-le-border bg-le-surface/50 px-8 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md p-1.5 text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-sm text-le-text-secondary">
            <span>{teacherModule.subject}</span>
            <ChevronRight className="h-3 w-3" />
            <span>Teacher Module</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <p className="label-badge text-le-accent">
            {teacherModule.chunkCount} study sections
          </p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-le-elevated">
            <div className="h-full w-full rounded-full bg-le-accent/30" />
          </div>
        </div>
      </div>

      {/* Content — matches lesson content layout */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-[680px]">
          <h1 className="heading text-3xl text-le-text">
            {teacherModule.title}
          </h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-le-text-secondary">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {teacherModule.pageCount} pages
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {teacherModule.chunkCount} study sections
            </span>
          </div>

          {/* Objectives-style card */}
          <div className="mt-6 rounded-lg border border-le-border bg-le-surface p-4">
            <p className="label-badge mb-2 text-le-text-hint">
              How to study this module
            </p>
            <ul className="space-y-1">
              <li className="flex items-start gap-2 text-sm text-le-text-secondary">
                <span className="mt-0.5 text-le-accent">•</span>
                Ask the AI tutor to explain any concept from the source material
              </li>
              <li className="flex items-start gap-2 text-sm text-le-text-secondary">
                <span className="mt-0.5 text-le-accent">•</span>
                The tutor will search {teacherModule.chunkCount} indexed sections
                for relevant answers
              </li>
              <li className="flex items-start gap-2 text-sm text-le-text-secondary">
                <span className="mt-0.5 text-le-accent">•</span>
                Try asking &ldquo;Explain...&rdquo;, &ldquo;What is...&rdquo;,
                or &ldquo;Quiz me on...&rdquo;
              </li>
            </ul>
          </div>

          {/* Key topics — styled like lesson sections */}
          {topics.length > 0 && (
            <div className="mt-8 space-y-8">
              <h2 className="heading text-xl text-le-text">
                Key Topics Covered
              </h2>

              {topics.map((topic, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-le-accent-soft px-6 py-5"
                >
                  <Key className="mt-0.5 h-5 w-5 flex-shrink-0 text-le-accent" />
                  <p className="text-[15px] font-semibold leading-relaxed text-le-text">
                    {topic}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* CTA — styled like the next-lesson area */}
          <div className="mt-12 flex flex-col items-center gap-4 border-t border-le-border pt-8 pb-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-le-accent-soft">
              <MessageSquare className="h-6 w-6 text-le-accent" />
            </div>
            <p className="text-center text-sm text-le-text-secondary">
              Ready to study? Open the AI tutor and start asking questions.
            </p>
            <button
              type="button"
              onClick={openTutor}
              className="flex items-center gap-2 rounded-xl bg-le-accent px-6 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110"
            >
              <Sparkles className="h-4 w-4" />
              Open AI Tutor
            </button>
          </div>
        </div>
      </div>

      {/* Floating tutor button — matches lesson view */}
      <button
        type="button"
        onClick={openTutor}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-le-accent px-5 py-3 text-sm font-semibold text-le-bg shadow-lg shadow-le-accent/25 transition-all hover:brightness-110"
      >
        <Sparkles className="h-4 w-4" />
        Ask the AI tutor
      </button>
    </div>
  );
}
