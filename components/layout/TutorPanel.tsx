"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { X, Send, Sparkles, RotateCcw } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { getTutorEngine, closeTutorEngine } from "@/lib/inference/engine";
import { retrieveLessonContext, GENERIC_TUTOR_PROMPT } from "@/lib/inference/tutorContext";
import {
  createSession,
  getAllSessions,
  getSessionMessages,
  addMessage,
  deleteSession,
  deleteSessionMessages,
} from "@/lib/db/indexeddb";
import { cleanResponse, generateId, cn } from "@/lib/utils";
import type { Message } from "@/types";

interface TutorPanelProps {
  onSendOverride?: (text: string) => Promise<void>;
}

const MAX_INPUT_PX = 200;

export function TutorPanel({ onSendOverride }: TutorPanelProps = {}) {
  const {
    tutorOpen,
    setTutorOpen,
    tutorMessages,
    addTutorMessage,
    clearTutorMessages,
    setTutorMessages,
    currentSessionId,
    setCurrentSessionId,
    isTutorGenerating,
    setIsTutorGenerating,
    tutorStreamingContent,
    setTutorStreamingContent,
    appendTutorStreamingContent,
    modelStatus,
    modelError,
    modelEngine,
    selectedSubject,
    currentLesson,
    activeProfileId,
  } = useAppStore();

  const [input, setInput] = useState("");
  const [contextWindowHit, setContextWindowHit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_INPUT_PX);
    el.style.height = `${next}px`;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tutorMessages, tutorStreamingContent]);

  useEffect(() => {
    if (tutorOpen && textareaRef.current) {
      textareaRef.current.focus();
      adjustTextareaHeight();
    }
  }, [tutorOpen, adjustTextareaHeight]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Derive a stable context key from the current subject + lesson.
  // vaultId on Session is repurposed to store this key for lookup.
  const contextKey = useMemo(
    () => `${activeProfileId || ""}:${selectedSubject || ""}:${currentLesson?.id || ""}`,
    [activeProfileId, selectedSubject, currentLesson?.id]
  );

  // Load or create session whenever the lesson / subject context changes.
  useEffect(() => {
    let cancelled = false;
    async function loadOrCreateSession() {
      const all = await getAllSessions();
      const match = all
        .filter((s) => s.vaultId === contextKey)
        .sort((a, b) => b.startedAt - a.startedAt)[0];

      if (match) {
        const stored = await getSessionMessages(match.id);
        const sorted = stored.sort((a, b) => a.timestamp - b.timestamp);
        if (!cancelled) {
          setCurrentSessionId(match.id);
          setTutorMessages(
            sorted.map(({ id, role, content, timestamp }) => ({
              id,
              role,
              content,
              timestamp,
            }))
          );
        }
      } else {
        const newId = generateId();
        await createSession({
          id: newId,
          startedAt: Date.now(),
          vaultId: contextKey,
        });
        if (!cancelled) {
          setCurrentSessionId(newId);
          clearTutorMessages();
        }
      }
    }
    void loadOrCreateSession();
    return () => {
      cancelled = true;
    };
  }, [contextKey, setCurrentSessionId, setTutorMessages, clearTutorMessages]);

  const handleNewConversation = useCallback(async () => {
    // Destroy the in-memory engine instance so the model context window is
    // fully cleared. Model files remain cached — no network requests are made.
    closeTutorEngine();
    if (currentSessionId) {
      await deleteSessionMessages(currentSessionId);
      await deleteSession(currentSessionId);
    }
    const newId = generateId();
    await createSession({
      id: newId,
      startedAt: Date.now(),
      vaultId: contextKey,
    });
    setCurrentSessionId(newId);
    clearTutorMessages();
    setContextWindowHit(false);
  }, [currentSessionId, contextKey, setCurrentSessionId, clearTutorMessages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTutorGenerating || modelStatus !== "ready") return;

    setInput("");
    setContextWindowHit(false);

    if (onSendOverride) {
      await onSendOverride(text);
      return;
    }

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    addTutorMessage(userMsg);
    if (currentSessionId) {
      void addMessage({ ...userMsg, sessionId: currentSessionId });
    }

    setIsTutorGenerating(true);
    setTutorStreamingContent("");

    try {
      const session = await getTutorEngine();

      // Truncate to last 4 messages to stay within context window.
      // Full history is still shown in the UI — only the model input is trimmed.
      const history = useAppStore
        .getState()
        .tutorMessages.slice(-4)
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          content: m.content,
        }));

      // Ground the answer in the actual lesson the student is on. The grounding
      // is retrieved fresh for this question and passed as the system preamble,
      // so the model answers from lesson material instead of hallucinating.
      const lesson = useAppStore.getState().currentLesson;
      const baseSystemPrompt =
        useAppStore.getState().tutorSystemPrompt || GENERIC_TUTOR_PROMPT;
      let effectiveSystemPrompt = baseSystemPrompt;
      if (lesson) {
        const grounding = retrieveLessonContext(lesson, text, 1100);
        if (grounding) {
          effectiveSystemPrompt = `${baseSystemPrompt}\n\nLesson material to use for your answer (do not contradict it; if it does not cover the question, say so):\n${grounding}`;
        }
      }

      const result = await session.streamResponse(
        history,
        (chunk) => {
          appendTutorStreamingContent(chunk);
        },
        effectiveSystemPrompt
      );

      const cleaned = cleanResponse(result);
      if (!cleaned) {
        setContextWindowHit(true);
      } else {
        const assistantMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: cleaned,
          timestamp: Date.now(),
        };
        addTutorMessage(assistantMsg);
        if (currentSessionId) {
          void addMessage({ ...assistantMsg, sessionId: currentSessionId });
        }
      }
    } catch (err) {
      console.error("Tutor generation error:", err);
      setContextWindowHit(true);
    } finally {
      setIsTutorGenerating(false);
      setTutorStreamingContent("");
    }
  }, [
    input,
    isTutorGenerating,
    modelStatus,
    onSendOverride,
    addTutorMessage,
    currentSessionId,
    setIsTutorGenerating,
    setTutorStreamingContent,
    appendTutorStreamingContent,
  ]);

  if (!tutorOpen) return null;

  return (
    <aside className="flex h-dvh w-[320px] flex-shrink-0 flex-col border-l border-le-border bg-le-surface animate-slide-in-right">
      <div className="flex items-center justify-between border-b border-le-border px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-le-accent/12">
            <Sparkles className="h-3.5 w-3.5 text-le-accent" />
          </div>
          <span className="font-semibold text-sm text-le-text">Lesson help</span>
          {modelStatus === "ready" && (
            <span className="h-2 w-2 rounded-full bg-le-green animate-pulse-dot" />
          )}
          {modelStatus === "ready" && modelEngine === "cpu" && (
            <span
              title="Running a lighter model on CPU — responses may be slower"
              className="rounded px-1 py-0.5 text-[10px] font-medium text-le-text-hint bg-le-elevated border border-le-border"
            >
              Lite
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleNewConversation()}
            disabled={tutorMessages.length === 0}
            title="New conversation"
            className="rounded-md p-1 text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text disabled:opacity-30"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTutorOpen(false)}
            className="rounded-md p-1 text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {tutorMessages.length === 0 && !tutorStreamingContent && (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-le-accent/10">
              <Sparkles className="h-6 w-6 text-le-accent" />
            </div>
            <p className="font-semibold text-sm text-le-text">Ask about this lesson</p>
            <p className="mt-1 text-xs text-le-text-secondary leading-relaxed">
              I can explain concepts, work through examples, or answer questions about what you just read.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {tutorMessages.flatMap((msg, i) => {
            const bubble = (
              <div
                key={msg.id}
                className={cn(
                  "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "ml-6 bg-le-accent/15 text-le-text"
                    : "mr-2 bg-le-elevated text-le-text"
                )}
              >
                {msg.content}
              </div>
            );
            const assistantCountSoFar = tutorMessages
              .slice(0, i + 1)
              .filter((m) => m.role === "assistant").length;
            if (msg.role === "assistant" && assistantCountSoFar === 3) {
              return [
                bubble,
                <p key="session-tip" className="py-1 text-center text-xs text-le-text-hint">
                  Tip: Start a new conversation for best results — the AI works best on shorter sessions.
                </p>,
              ];
            }
            return [bubble];
          })}
          {tutorStreamingContent && (
            <div className="mr-4 rounded-lg bg-le-elevated px-3 py-2.5 text-sm leading-relaxed tabular-nums text-le-text">
              {cleanResponse(tutorStreamingContent)}
            </div>
          )}
          {contextWindowHit && (
            <div className="mr-4 rounded-lg border border-le-border bg-le-elevated px-3 py-3 text-sm leading-relaxed text-le-text">
              <p className="mb-2 text-le-text-secondary">
                This conversation has gotten too long. Starting fresh will give you better responses.
              </p>
              <button
                type="button"
                onClick={() => void handleNewConversation()}
                className="text-sm font-medium text-le-accent hover:underline"
              >
                Start fresh →
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-le-border p-3">
        <div
          className={cn(
            "flex gap-2 rounded-xl border border-le-border bg-le-bg px-3 py-2",
            "items-end"
          )}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={
              modelStatus === "ready"
                ? "Ask about this lesson…"
                : modelStatus === "loading"
                  ? "Type here — send when ready…"
                  : modelStatus === "error"
                    ? "Lesson help unavailable — tap to retry?"
                    : "Ask about this lesson…"
            }
            readOnly={isTutorGenerating}
            aria-disabled={isTutorGenerating}
            className={cn(
              "max-h-[200px] min-h-[40px] min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed text-le-text placeholder:text-le-text-hint outline-none",
              isTutorGenerating && "cursor-wait opacity-60"
            )}
            style={{ height: "40px" }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isTutorGenerating || modelStatus !== "ready"}
            className="mb-1.5 flex-shrink-0 rounded-md p-1.5 text-le-accent transition-colors hover:bg-le-accent-soft disabled:opacity-30"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {modelStatus !== "ready" && (
          <p className="mt-2 px-0.5 text-xs leading-snug text-le-text-hint">
            {modelStatus === "loading" &&
              (modelEngine === "cpu"
                ? "Downloading a lightweight model — this only runs once. You can draft your message; Send enables when ready."
                : "Loading the help model — you can draft your message; Send stays off until ready.")}
            {modelStatus === "error" &&
              (modelError ?? "Could not load lesson help. Try refreshing the page.")}
            {modelStatus === "idle" && "Starting lesson help…"}
          </p>
        )}
      </div>
    </aside>
  );
}
