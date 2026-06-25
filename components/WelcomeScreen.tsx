"use client";

import { WifiOff, BookOpen, Target, ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

interface WelcomeScreenProps {
  onStart: () => void;
}

const FEATURES = [
  {
    icon: WifiOff,
    title: "Works 100% offline",
    description:
      "Every lesson, quiz, and the AI tutor run entirely in your browser. Nothing leaves your device.",
  },
  {
    icon: BookOpen,
    title: "Structured curriculum",
    description:
      "Six subjects sequenced like a real course — not a search engine, a teacher.",
  },
  {
    icon: Target,
    title: "SAT & ACT prep",
    description: "Timed practice sets with guided explanations. Free. Forever.",
  },
] as const;

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="le-app-shell fixed inset-0 z-50 flex items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-5xl flex-col gap-14 lg:flex-row lg:items-center lg:gap-20">

        {/* Left: hero statement */}
        <div className="flex flex-col gap-8 lg:flex-1">
          <div className="flex items-center gap-3">
            <BrandLogo size={36} className="drop-shadow-[0_0_20px_rgba(96,165,250,0.4)]" />
            <span className="font-display font-bold text-base text-le-accent">OffLearn</span>
          </div>

          <div className="flex flex-col gap-4">
            <h1 className="font-display font-bold text-le-text" style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
              Every student deserves a great teacher.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-le-text-secondary">
              A full school in your browser — curriculum, test prep, and an
              on-device AI tutor. No internet after setup. No cost. No data
              leaving this device.
            </p>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="group flex w-fit items-center gap-2 rounded-xl bg-le-accent px-7 py-3.5 text-base font-semibold text-white shadow-glow transition-all hover:brightness-110 hover:shadow-[0_14px_40px_-12px_rgba(96,165,250,0.55)]"
          >
            Start learning
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <p className="text-xs text-le-text-hint">
            Desktop browsers recommended · Your sessions stay on this device · Lesson help uses WebGPU or a lightweight CPU fallback
          </p>
        </div>

        {/* Right: feature cards */}
        <div className="flex flex-col gap-3 lg:w-[340px] lg:flex-shrink-0">
          {FEATURES.map((feat, i) => (
            <div
              key={feat.title}
              className="flex items-start gap-4 rounded-2xl border border-le-border bg-le-surface/80 p-5 backdrop-blur-sm"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-le-accent/10">
                <feat.icon className="h-5 w-5 text-le-accent" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-le-text">{feat.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-le-text-secondary">
                  {feat.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
