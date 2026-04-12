"use client";

import { useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import type { TestBank, TestQuestion, Difficulty } from "@/types";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Clock,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  BarChart3,
} from "lucide-react";

const TEST_SECTIONS = [
  {
    id: "sat-math",
    title: "SAT Math",
    subtitle: "25 questions",
    time: "~35 min",
    file: "/testprep/sat-math.json",
  },
  {
    id: "sat-reading",
    title: "SAT Reading",
    subtitle: "25 questions",
    time: "~30 min",
    file: "/testprep/sat-reading.json",
  },
  {
    id: "act-math",
    title: "ACT Math",
    subtitle: "25 questions",
    time: "~40 min",
    file: "/testprep/act-math.json",
  },
];

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-le-green/15 text-le-green",
  medium: "bg-le-accent/15 text-le-accent",
  hard: "bg-le-red/15 text-le-red",
};

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={cn(
        "label-badge rounded-full px-2.5 py-0.5",
        DIFFICULTY_COLORS[difficulty]
      )}
    >
      {difficulty}
    </span>
  );
}

export function TestPrepView() {
  const {
    currentTestBank,
    setCurrentTestBank,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    selectedAnswer,
    setSelectedAnswer,
    answeredCorrectly,
    setAnsweredCorrectly,
    testAnswers,
    recordTestAnswer,
    testComplete,
    setTestComplete,
    resetTestSession,
    setTutorOpen,
    setTutorSystemPrompt,
    clearTutorMessages,
  } = useAppStore();

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  const startPractice = useCallback(
    async (sectionId: string) => {
      const section = TEST_SECTIONS.find((s) => s.id === sectionId);
      if (!section) return;

      try {
        const res = await fetch(section.file);
        const data = (await res.json()) as TestBank;
        resetTestSession();
        setCurrentTestBank(data.questions);
        setActiveSection(sectionId);
      } catch (err) {
        console.error("Failed to load test bank:", err);
      }
    },
    [resetTestSession, setCurrentTestBank]
  );

  const handleSelectAnswer = useCallback(
    (optionIdx: number) => {
      if (selectedAnswer !== null) return;

      const question = currentTestBank[currentQuestionIndex];
      const isCorrect = optionIdx === question.correct;

      setSelectedAnswer(optionIdx);
      setAnsweredCorrectly(isCorrect);
      recordTestAnswer(currentQuestionIndex, optionIdx, isCorrect);

      if (!isCorrect) {
        const wrongOption = question.options[optionIdx];
        const correctOption = question.options[question.correct];
        const systemPrompt = `The student answered "${wrongOption}" for this question: ${question.question}. The correct answer is "${correctOption}". ${question.aiHint}

Guide the student Socratically to understand WHY the correct answer is right without just stating it. Ask questions that lead them to the reasoning. Be encouraging and patient.`;
        clearTutorMessages();
        setTutorSystemPrompt(systemPrompt);
        setTutorOpen(true);
      }
    },
    [
      selectedAnswer,
      currentTestBank,
      currentQuestionIndex,
      setSelectedAnswer,
      setAnsweredCorrectly,
      recordTestAnswer,
      clearTutorMessages,
      setTutorSystemPrompt,
      setTutorOpen,
    ]
  );

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex + 1 >= currentTestBank.length) {
      setTestComplete(true);
      setTutorOpen(false);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setAnsweredCorrectly(null);
      setTutorOpen(false);
    }
  }, [
    currentQuestionIndex,
    currentTestBank.length,
    setCurrentQuestionIndex,
    setSelectedAnswer,
    setAnsweredCorrectly,
    setTestComplete,
    setTutorOpen,
  ]);

  const goBackToMenu = useCallback(() => {
    resetTestSession();
    setActiveSection(null);
    setReviewMode(false);
    setTutorOpen(false);
  }, [resetTestSession, setTutorOpen]);

  // Score card
  if (testComplete && !reviewMode) {
    const total = currentTestBank.length;
    const correct = Object.values(testAnswers).filter((a) => a.correct).length;
    const pct = Math.round((correct / total) * 100);

    const topicBreakdown: Record<string, { correct: number; total: number }> = {};
    currentTestBank.forEach((q, i) => {
      if (!topicBreakdown[q.topic]) {
        topicBreakdown[q.topic] = { correct: 0, total: 0 };
      }
      topicBreakdown[q.topic].total += 1;
      if (testAnswers[i]?.correct) {
        topicBreakdown[q.topic].correct += 1;
      }
    });

    const encouragement =
      pct >= 80
        ? "Outstanding work! You are well prepared."
        : pct >= 60
          ? "Good progress! Focus on the topics below to improve."
          : "Keep practicing — every question you review makes you stronger.";

    return (
      <div className="flex flex-1 items-center justify-center px-8 py-12">
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-le-accent-soft">
              <BarChart3 className="h-10 w-10 text-le-accent" />
            </div>
            <h1 className="heading text-3xl text-le-text">Practice Complete!</h1>
            <p className="text-5xl font-bold text-le-accent">
              {correct}/{total}
            </p>
            <p className="text-sm text-le-text-secondary">{pct}% correct</p>
            <p className="text-sm text-le-text-secondary">{encouragement}</p>
          </div>

          <div className="mt-8 rounded-xl border border-le-border bg-le-surface p-5">
            <p className="label-badge mb-3 text-le-text-hint">Topic Breakdown</p>
            <div className="space-y-2">
              {Object.entries(topicBreakdown).map(([topic, data]) => (
                <div key={topic} className="flex items-center justify-between text-sm">
                  <span className="text-le-text-secondary">{topic}</span>
                  <span
                    className={cn(
                      "font-medium",
                      data.correct === data.total ? "text-le-green" : "text-le-red"
                    )}
                  >
                    {data.correct}/{data.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setReviewMode(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-le-border bg-le-surface px-4 py-3 text-sm font-medium text-le-text transition-colors hover:bg-le-elevated"
            >
              <RotateCcw className="h-4 w-4" />
              Review missed
            </button>
            <button
              type="button"
              onClick={goBackToMenu}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-le-accent px-4 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110"
            >
              Try another section
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Review mode
  if (testComplete && reviewMode) {
    const missedQuestions = currentTestBank
      .map((q, i) => ({ question: q, index: i }))
      .filter((item) => !testAnswers[item.index]?.correct);

    return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => setReviewMode(false)}
              className="rounded-md p-1.5 text-le-text-secondary hover:bg-le-hover hover:text-le-text"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <h1 className="heading text-xl text-le-text">
              Review Missed Questions ({missedQuestions.length})
            </h1>
          </div>
          {missedQuestions.length === 0 ? (
            <p className="text-sm text-le-text-secondary">
              You got every question right! Nothing to review.
            </p>
          ) : (
            <div className="space-y-6">
              {missedQuestions.map(({ question, index }) => {
                const answer = testAnswers[index];
                return (
                  <div
                    key={question.id}
                    className="rounded-xl border border-le-border bg-le-surface p-5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <DifficultyBadge difficulty={question.difficulty} />
                      <span className="text-xs text-le-text-hint">{question.topic}</span>
                    </div>
                    <p className="text-sm font-medium text-le-text mb-3">{question.question}</p>
                    <div className="space-y-2 mb-4">
                      {question.options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className={cn(
                            "rounded-lg px-4 py-2.5 text-sm",
                            optIdx === question.correct
                              ? "border border-le-green/30 bg-le-green/10 text-le-green"
                              : optIdx === answer?.selected
                                ? "border border-le-red/30 bg-le-red/10 text-le-red"
                                : "border border-le-border text-le-text-secondary"
                          )}
                        >
                          <span className="font-medium mr-2">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg bg-le-elevated px-4 py-3">
                      <p className="label-badge mb-1 text-le-accent">Explanation</p>
                      <p className="text-sm leading-relaxed text-le-text-secondary">
                        {question.explanation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-8 pb-8">
            <button
              type="button"
              onClick={goBackToMenu}
              className="rounded-xl bg-le-accent px-6 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110"
            >
              Try another section
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active test session
  if (currentTestBank.length > 0 && activeSection) {
    const question = currentTestBank[currentQuestionIndex];
    const total = currentTestBank.length;
    const answered = Object.keys(testAnswers).length;

    return (
      <div className="flex flex-1 flex-col">
        {/* Progress bar */}
        <div className="border-b border-le-border bg-le-surface/50 px-8 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-le-text">
                Question {currentQuestionIndex + 1} of {total}
              </span>
              <span className="text-xs text-le-text-hint">—</span>
              <span className="text-xs text-le-text-secondary">{question.topic}</span>
            </div>
            <DifficultyBadge difficulty={question.difficulty} />
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-le-elevated">
            <div
              className="h-full rounded-full bg-le-accent transition-all"
              style={{ width: `${(answered / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto max-w-2xl">
            {question.passage && (
              <div className="mb-6 rounded-lg border-l-4 border-le-text-hint bg-le-surface/50 px-6 py-4">
                <p className="text-sm italic leading-relaxed text-le-text-secondary">
                  {question.passage}
                </p>
              </div>
            )}

            <p className="text-lg font-medium leading-relaxed text-le-text">
              {question.question}
            </p>

            <div className="mt-6 space-y-3">
              {question.options.map((option, optIdx) => {
                const isSelected = selectedAnswer === optIdx;
                const isCorrectOption = optIdx === question.correct;
                const showResult = selectedAnswer !== null;

                let cardStyle = "border-le-border bg-le-surface hover:border-le-border-strong hover:bg-le-elevated cursor-pointer";
                if (showResult) {
                  if (isCorrectOption) {
                    cardStyle = "border-le-green/40 bg-le-green/10";
                  } else if (isSelected && !answeredCorrectly) {
                    cardStyle = "border-le-red/40 bg-le-red/10";
                  } else {
                    cardStyle = "border-le-border bg-le-surface opacity-60";
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectAnswer(optIdx)}
                    disabled={selectedAnswer !== null}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all",
                      cardStyle,
                      showResult && isCorrectOption && "celebrate-pulse"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                        showResult && isCorrectOption
                          ? "bg-le-green/20 text-le-green"
                          : showResult && isSelected
                            ? "bg-le-red/20 text-le-red"
                            : "bg-le-elevated text-le-text-secondary"
                      )}
                    >
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span className="flex-1 text-sm text-le-text">{option}</span>
                    {showResult && isCorrectOption && (
                      <CheckCircle2 className="h-5 w-5 text-le-green" />
                    )}
                    {showResult && isSelected && !isCorrectOption && (
                      <XCircle className="h-5 w-5 text-le-red" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedAnswer !== null && (
              <div className="mt-6 animate-fade-in-up">
                <div
                  className={cn(
                    "rounded-xl px-5 py-4",
                    answeredCorrectly ? "bg-le-green/10" : "bg-le-red/10"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {answeredCorrectly ? (
                      <CheckCircle2 className="h-5 w-5 text-le-green" />
                    ) : (
                      <XCircle className="h-5 w-5 text-le-red" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        answeredCorrectly ? "text-le-green" : "text-le-red"
                      )}
                    >
                      {answeredCorrectly ? "Correct!" : "Not quite right"}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-le-text-secondary">
                    {question.explanation}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-le-accent px-6 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110"
                >
                  {currentQuestionIndex + 1 >= total ? "See results" : "Next question"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Test prep landing
  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="heading text-2xl text-le-text">Test Prep</h1>
        <p className="mt-1 text-sm text-le-text-secondary">
          Practice with real-format questions and AI-guided explanations
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {TEST_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => startPractice(section.id)}
              className="group flex flex-col items-center gap-4 rounded-xl border border-le-border bg-le-surface p-6 text-center transition-all hover:border-le-border-strong hover:bg-le-elevated"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-le-accent-soft">
                <ClipboardList className="h-7 w-7 text-le-accent" />
              </div>
              <div>
                <h3 className="heading text-base text-le-text">{section.title}</h3>
                <p className="mt-1 text-xs text-le-text-secondary">{section.subtitle}</p>
                <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-le-text-hint">
                  <Clock className="h-3 w-3" />
                  {section.time}
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-lg bg-le-accent px-4 py-2 text-xs font-semibold text-le-bg transition-all group-hover:brightness-110">
                Start Practice
                <ChevronRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
