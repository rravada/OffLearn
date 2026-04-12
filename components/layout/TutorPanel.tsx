"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { LLMSession } from "@/lib/inference/mediapipe";
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
    tutorSystemPrompt,
    isTutorGenerating,
    setIsTutorGenerating,
    tutorStreamingContent,
    setTutorStreamingContent,
    appendTutorStreamingContent,
    modelStatus,
  } = useAppStore();

  const [input, setInput] = useState("");
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

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTutorGenerating || modelStatus !== "ready") return;

    setInput("");

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

    setIsTutorGenerating(true);
    setTutorStreamingContent("");

    try {
      const session = await LLMSession.getInstance();

      const conversationContext = useAppStore
        .getState()
        .tutorMessages.map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
        .join("\n");

      const fullPrompt = `${conversationContext}\nStudent: ${text}`;

      const result = await session.streamResponse(
        fullPrompt,
        (chunk) => {
          appendTutorStreamingContent(chunk);
        },
        tutorSystemPrompt
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
      console.error("Tutor generation error:", err);
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
  }, [
    input,
    isTutorGenerating,
    modelStatus,
    onSendOverride,
    addTutorMessage,
    setIsTutorGenerating,
    setTutorStreamingContent,
    appendTutorStreamingContent,
    tutorSystemPrompt,
  ]);

  if (!tutorOpen) return null;

  return (
    <aside className="flex h-dvh w-[320px] flex-shrink-0 flex-col border-l border-le-border bg-le-surface animate-slide-in-right">
      <div className="flex items-center justify-between border-b border-le-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-le-accent" />
          <span className="heading text-sm text-le-text">AI Tutor</span>
          {modelStatus === "ready" && (
            <span className="h-2 w-2 rounded-full bg-le-green animate-pulse-dot" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setTutorOpen(false)}
          className="rounded-md p-1 text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {tutorMessages.length === 0 && !tutorStreamingContent && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-le-text-hint" />
            <p className="text-sm text-le-text-secondary">
              Ask me anything about this lesson.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {tutorMessages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "ml-8 bg-le-accent/15 text-le-text"
                  : "mr-4 bg-le-elevated text-le-text"
              }`}
            >
              {msg.content}
            </div>
          ))}
          {tutorStreamingContent && (
            <div className="mr-4 rounded-lg bg-le-elevated px-3 py-2.5 text-sm leading-relaxed text-le-text">
              {cleanResponse(tutorStreamingContent)}
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
                handleSend();
              }
            }}
            placeholder="Ask the tutor..."
            disabled={isTutorGenerating || modelStatus !== "ready"}
            className="max-h-[200px] min-h-[40px] w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed text-le-text placeholder:text-le-text-hint outline-none disabled:opacity-50"
            style={{ height: "40px" }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isTutorGenerating || modelStatus !== "ready"}
            className="mb-1.5 flex-shrink-0 rounded-md p-1.5 text-le-accent transition-colors hover:bg-le-accent-soft disabled:opacity-30"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
