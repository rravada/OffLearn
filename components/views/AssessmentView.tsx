"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, ClipboardList } from "lucide-react";
import type { AssessmentData, AssessmentQuestion, AssessmentResult, CurriculumSubject, CurriculumUnit } from "@/types";
import { saveAssessmentResult, getAssessmentResult } from "@/lib/db/indexeddb";

interface AssessmentViewProps {
  data: AssessmentData;
  subject: CurriculumSubject;
  unit: CurriculumUnit;
  lessonIdx: number;
  totalLessons: number;
  onBack: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

function sample(bank: AssessmentQuestion[], n: number): AssessmentQuestion[] {
  const a = [...bank];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export function AssessmentView({
  data,
  subject,
  unit,
  lessonIdx,
  totalLessons,
  onBack,
  onPrevious,
  onNext,
}: AssessmentViewProps) {
  const [phase, setPhase] = useState<"taking" | "results">("taking");
  const [sampled, setSampled] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [priorResult, setPriorResult] = useState<AssessmentResult | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    setSampled(sample(data.bank, data.questionsPerAttempt));
    getAssessmentResult(data.id).then(setPriorResult).catch(() => {});
  }, [data.id, data.bank, data.questionsPerAttempt]);

  const handleAnswer = useCallback((qIdx: number, optIdx: number) => {
    setAnswers((prev) => {
      if (prev[qIdx] === optIdx) {
        const next = { ...prev };
        delete next[qIdx];
        return next;
      }
      return { ...prev, [qIdx]: optIdx };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    let correct = 0;
    sampled.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct++;
    });
    const result: AssessmentResult = {
      assessmentId: data.id,
      score: correct,
      total: sampled.length,
      dateTaken: Date.now(),
    };
    saveAssessmentResult(result).catch(() => {});
    setPriorResult(result);
    setScore(correct);
    setPhase("results");
  }, [sampled, answers, data.id]);

  const handleRetake = useCallback(() => {
    setSampled(sample(data.bank, data.questionsPerAttempt));
    setAnswers({});
    setPhase("taking");
  }, [data.bank, data.questionsPerAttempt]);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === sampled.length && sampled.length > 0;
  const pct = sampled.length > 0 ? score / sampled.length : 0;
  const passed = pct >= 0.7;
  const typeLabel = data.type === "course-final" ? "Final Exam" : "Unit Review";

  return (
    <div className="flex w-full flex-col">
      <div className="sticky top-0 z-20 border-b border-le-border bg-le-surface/95 px-8 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md p-1.5 text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-sm text-le-text-secondary">
            <span>{subject.title}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{unit.title}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <p className="label-badge text-le-accent">
            {typeLabel} · {lessonIdx + 1} of {totalLessons}
          </p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-le-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-le-mint/90 to-le-accent transition-all"
              style={{ width: `${((lessonIdx + 1) / totalLessons) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-8 pb-16 pt-6">
        <div className="mx-auto max-w-[680px]">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-le-accent" />
            <h1 className="heading text-3xl text-le-text">{data.title}</h1>
          </div>

          {phase === "taking" && (
            <>
              <div className="mt-3 flex items-center gap-4">
                <p className="text-sm text-le-text-secondary">
                  {answeredCount} of {sampled.length} answered
                </p>
                {priorResult && (
                  <span className="rounded-full border border-le-border bg-le-elevated px-2.5 py-0.5 text-xs text-le-text-hint">
                    Last attempt: {priorResult.score}/{priorResult.total}
                  </span>
                )}
              </div>

              <div className="mt-8 space-y-8">
                {sampled.map((q, qIdx) => (
                  <div key={qIdx} className="rounded-lg border border-le-border bg-le-surface/70 p-5">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-le-text-hint">
                      Question {qIdx + 1}
                    </p>
                    <p className="mb-4 text-[15px] font-medium text-le-text">{q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = answers[qIdx] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleAnswer(qIdx, optIdx)}
                            className={
                              isSelected
                                ? "w-full rounded-lg border border-le-accent bg-le-accent/10 px-4 py-2.5 text-left text-sm text-le-accent transition-colors"
                                : "w-full rounded-lg border border-le-border bg-le-elevated px-4 py-2.5 text-left text-sm text-le-text transition-colors hover:border-le-mint/40 hover:bg-le-hover"
                            }
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  type="button"
                  disabled={!allAnswered}
                  onClick={handleSubmit}
                  className="rounded-xl bg-le-accent px-8 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Submit Assessment
                </button>
              </div>
            </>
          )}

          {phase === "results" && (
            <>
              <div className="mt-6 rounded-xl border border-le-border bg-le-surface p-6">
                <p className="text-2xl font-bold text-le-text">
                  You scored {score} out of {sampled.length}
                </p>
                <p className="mt-1 text-sm text-le-text-secondary">
                  {Math.round(pct * 100)}% correct
                </p>
                <div className="mt-3">
                  {passed ? (
                    <span className="inline-flex items-center rounded-full border border-green-500/40 bg-green-900/20 px-3 py-1 text-sm font-semibold text-green-300">
                      Passed
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-900/20 px-3 py-1 text-sm font-semibold text-amber-300">
                      Needs Review
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-8 space-y-6">
                {sampled.map((q, qIdx) => {
                  const chosen = answers[qIdx];
                  const correct = q.correctIndex;
                  const isRight = chosen === correct;
                  return (
                    <div key={qIdx} className="rounded-lg border border-le-border bg-le-surface/70 p-5">
                      <div className="mb-3 flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isRight
                              ? "bg-green-900/40 text-green-400"
                              : "bg-red-900/40 text-red-400"
                          }`}
                        >
                          {isRight ? "✓" : "✗"}
                        </span>
                        <p className="text-[15px] font-medium text-le-text">{q.question}</p>
                      </div>
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const wasChosen = chosen === optIdx;
                          const isCorrect = correct === optIdx;
                          let cls =
                            "w-full rounded-lg border px-4 py-2.5 text-left text-sm ";
                          if (isCorrect) {
                            cls += "border-green-500/50 bg-green-900/20 text-green-300";
                          } else if (wasChosen && !isCorrect) {
                            cls += "border-red-500/50 bg-red-900/20 text-red-300";
                          } else {
                            cls += "border-le-border/50 bg-le-elevated/50 text-le-text/50";
                          }
                          return (
                            <div key={optIdx} className={cls}>
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-le-text/80">
                        {q.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-12 flex flex-col gap-4 border-t border-le-border pt-8 pb-16 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  {onPrevious && (
                    <button
                      type="button"
                      onClick={onPrevious}
                      className="flex items-center gap-2 rounded-xl border border-le-border bg-le-surface px-6 py-3 text-sm font-medium text-le-text transition-colors hover:bg-le-elevated"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="flex items-center gap-2 rounded-xl border border-le-border bg-le-surface px-6 py-3 text-sm font-medium text-le-text transition-colors hover:bg-le-elevated"
                  >
                    Retake Assessment
                  </button>
                </div>
                {onNext && (
                  <button
                    type="button"
                    onClick={onNext}
                    className="flex items-center gap-2 rounded-xl bg-le-accent px-6 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110 sm:ml-auto sm:inline-flex"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
